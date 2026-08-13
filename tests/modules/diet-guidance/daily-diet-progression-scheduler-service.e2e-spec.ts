import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { DailyDietProgressionSchedulerService } from '../../../src/modules/diet-guidance/services/daily-diet-progression-scheduler.service';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../../../src/modules/patient/entities/pod-protocol-tracking-log.entity';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// processDailyDietProgression() has no HTTP route of its own beyond a manual
// trigger endpoint tested separately in diet-guidance-controller.e2e-spec.ts
// (which also covers the ADVANCED / YELLOW-MAINTAINED / at-max-MAINTAINED /
// aggregate-count / tracking-log branches against real seeded + freshly seeded
// data). This spec exercises the scheduler service directly against a real DB
// for the branches the controller spec doesn't already cover: patient
// eligibility filtering (currentPod/podStartDate/erasCompleted/isLocked), the
// RED-specific maintain reason, the same-POD fallback survey lookup, and the
// podSoftDietReached side effect when a patient first reaches diet level 4.
describe('DailyDietProgressionSchedulerService (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let scheduler: DailyDietProgressionSchedulerService;
  let patientRepo: Repository<Patient>;
  let surveyRepo: Repository<SymptomSurvey>;
  let trackingLogRepo: Repository<PodProtocolTrackingLog>;

  beforeAll(async () => {
    dataSource = await getTestDataSource();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    scheduler = app.get(DailyDietProgressionSchedulerService);
    patientRepo = dataSource.getRepository(Patient);
    surveyRepo = dataSource.getRepository(SymptomSurvey);
    trackingLogRepo = dataSource.getRepository(PodProtocolTrackingLog);
  });

  beforeEach(async () => {
    await resetTestDataSource();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('processDailyDietProgression()', () => {
    describe('GIVEN a patient with no currentPod (ERAS not yet started)', () => {
      it('THEN should exclude that patient from the scan entirely', async () => {
        await patientRepo.update({ caseId: 'CASE-002' }, { currentPod: null });

        const result = await scheduler.processDailyDietProgression();

        expect(result.totalProcessed).toBe(9);
        expect(result.details.some((d) => d.caseId === 'CASE-002')).toBe(false);
      });
    });

    describe('GIVEN a patient marked erasCompleted', () => {
      it('THEN should exclude that patient from the scan entirely', async () => {
        await patientRepo.update({ caseId: 'CASE-002' }, { erasCompleted: true });

        const result = await scheduler.processDailyDietProgression();

        expect(result.totalProcessed).toBe(9);
        expect(result.details.some((d) => d.caseId === 'CASE-002')).toBe(false);
      });
    });

    describe('GIVEN a patient marked isLocked', () => {
      it('THEN should exclude that patient from the scan entirely', async () => {
        await patientRepo.update({ caseId: 'CASE-002' }, { isLocked: true });

        const result = await scheduler.processDailyDietProgression();

        expect(result.totalProcessed).toBe(9);
        expect(result.details.some((d) => d.caseId === 'CASE-002')).toBe(false);
      });
    });

    describe('GIVEN a patient whose latest assessment today is RED', () => {
      it('THEN should maintain their diet level with the RED-specific reason', async () => {
        await surveyRepo.save({
          caseId: 'CASE-002',
          evaluationDatetime: new Date(),
          triageColor: 'RED',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        const result = await scheduler.processDailyDietProgression();

        const item = result.details.find((d) => d.caseId === 'CASE-002');
        expect(item).toEqual(
          expect.objectContaining({
            caseId: 'CASE-002',
            action: 'MAINTAINED',
            latestTriageColor: 'RED',
          }),
        );
        expect(item?.reason).toContain('ĐỎ');
      });
    });

    describe('GIVEN no assessment was completed today but one exists for the patient current POD context', () => {
      it('THEN should fall back to that assessment and advance on GREEN', async () => {
        const patient = await patientRepo.findOneOrFail({ where: { caseId: 'CASE-002' } });

        // Remove the seed-fixture survey (dated "today" by construction) so the
        // primary today-window query finds nothing, forcing the fallback path.
        await surveyRepo.delete({ caseId: 'CASE-002' });
        await surveyRepo.save({
          caseId: 'CASE-002',
          evaluationDatetime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          podContext: patient.currentPod,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        const result = await scheduler.processDailyDietProgression();

        expect(result.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              caseId: 'CASE-002',
              action: 'ADVANCED',
              latestTriageColor: 'GREEN',
              previousDietLevel: 0,
              newDietLevel: 1,
            }),
          ]),
        );
      });
    });

    describe('GIVEN a patient advancing to diet level 4 for the first time', () => {
      it('THEN should record podSoftDietReached as their current POD', async () => {
        await patientRepo.update({ caseId: 'CASE-002' }, { currentDietLevel: 3 });
        await surveyRepo.save({
          caseId: 'CASE-002',
          evaluationDatetime: new Date(),
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        await scheduler.processDailyDietProgression();

        const patient = await patientRepo.findOneOrFail({ where: { caseId: 'CASE-002' } });
        expect(patient.currentDietLevel).toBe(4);
        expect(patient.podSoftDietReached).toBe(patient.currentPod);
      });

      // Kept separate: the tracking-log audit write is an independent side
      // effect from the patient row update, not part of the same DB write.
      it('THEN should still write exactly one tracking log entry for that patient', async () => {
        await patientRepo.update({ caseId: 'CASE-002' }, { currentDietLevel: 3 });
        await surveyRepo.save({
          caseId: 'CASE-002',
          evaluationDatetime: new Date(),
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        await scheduler.processDailyDietProgression();

        const logs = await trackingLogRepo.find({ where: { caseId: 'CASE-002' } });
        expect(logs).toHaveLength(1);
        expect(logs[0]).toEqual(
          expect.objectContaining({
            actionType: 'System_Auto',
            oldStatus: 'Mức ăn 3',
            newStatus: 'Mức ăn 4',
          }),
        );
      });
    });
  });
});
