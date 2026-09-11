import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { AlertService } from '../../../src/modules/alert/services/alert.service';
import { StatisticsGateway } from '../../../src/modules/statistics/gateways/statistics.gateway';
import { SymptomSurveyService } from '../../../src/modules/symptom-survey/services/symptom-survey.service';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { CreateReassessmentDto } from '../../../src/modules/symptom-survey/dtos/create-reassessment.dto';
import { AssessmentDetail } from '../../../src/modules/symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from '../../../src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../../../src/modules/symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import { UserResponseDto } from '../../../src/modules/user/dtos/user-response.dto';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// seed.ts assigns nurse01 the user id 3 (see alert-service.e2e-spec.ts's own comment
// to that effect), so submitReassessment's nurseId persistence can be asserted
// against a real, known nurse id rather than a fabricated one.
const nurseCaller: UserResponseDto = {
  id: 3,
  username: 'nurse01',
  fullName: 'Điều dưỡng 01',
  phoneNumber: null,
  caseId: null,
  roles: [UserRoleName.NURSE],
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// SymptomSurveyService#getAssessmentHistory has no route on SymptomSurveyController
// itself — it's exposed via PatientController's GET /patients/:id/history — so it's
// exercised here directly against the real DB rather than via supertest against a
// route that belongs to a different module.
describe('SymptomSurveyService (integration)', () => {
  let app: INestApplication;
  let symptomSurveyService: SymptomSurveyService;
  let alertService: DeepMocked<AlertService>;
  let statisticsGateway: DeepMocked<StatisticsGateway>;
  let dataSource: DataSource;
  let questionId: number;
  let optionId: number;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    alertService = createMock<AlertService>();
    statisticsGateway = createMock<StatisticsGateway>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(AlertService)
      .useValue(alertService)
      .overrideProvider(StatisticsGateway)
      .useValue(statisticsGateway)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    symptomSurveyService = app.get(SymptomSurveyService);
  });

  beforeEach(async () => {
    await resetTestDataSource();
    alertService.updateAlertsOnReassessment.mockClear();
    statisticsGateway.emitAssessmentSubmitted.mockClear();

    // seed.ts creates one assessment per seeded patient case (including CASE-001),
    // which would otherwise pollute this suite's own history counts/ordering.
    await dataSource.createQueryBuilder().delete().from(AssessmentDetail).execute();
    await dataSource.createQueryBuilder().delete().from(SymptomSurvey).execute();
    await dataSource.createQueryBuilder().delete().from(QuestionOption).execute();
    await dataSource.createQueryBuilder().delete().from(SurveyQuestion).execute();

    const question = await dataSource.getRepository(SurveyQuestion).save({
      questionText: 'Bạn có buồn nôn không?',
      orderNumber: 1,
      isDefault: true,
      questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
    });
    questionId = question.questionId;
    const option = await dataSource
      .getRepository(QuestionOption)
      .save({ questionId, optionText: 'Nặng', scoreValue: 5 });
    optionId = option.optionId;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('getAssessmentHistory()', () => {
    describe('GIVEN a case with multiple past assessments', () => {
      it('THEN should return them newest evaluation_datetime first, each with its answer details', async () => {
        const surveyRepo = dataSource.getRepository(SymptomSurvey);
        const older = await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-01T08:00:00.000Z'),
          totalScore: 0,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        const newer = await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-02T08:00:00.000Z'),
          totalScore: 5,
          triageColor: 'RED',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(AssessmentDetail).save({
          assessmentId: newer.assessmentId,
          questionId,
          selectedOptionId: optionId,
          scoreEarned: 5,
        });

        const result = await symptomSurveyService.getAssessmentHistory('CASE-001', 1, 10);

        expect(result.total).toBe(2);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
        expect(result.data.map((d) => d.assessmentId)).toEqual([
          newer.assessmentId,
          older.assessmentId,
        ]);
        expect(result.data[0].details).toEqual([
          expect.objectContaining({ questionId, selectedOptionId: optionId, scoreEarned: 5 }),
        ]);
        expect(result.data[1].details).toEqual([]);

        // Both rows were inserted without an explicit `source`, so the DB-level
        // default('SURVEY') applies — this is what tells a normal patient-submitted
        // survey apart from a nurse REASSESSMENT/NOTE row in the same timeline.
        expect(result.data[0].source).toBe('SURVEY');
        expect(result.data[0].nurseNote).toBeNull();
        expect(result.data[1].source).toBe('SURVEY');
        expect(result.data[1].nurseNote).toBeNull();
      });
    });

    describe('GIVEN a case with a nurse-created REASSESSMENT row alongside a plain SURVEY row', () => {
      it("THEN should surface each row's own source and nurseNote", async () => {
        const surveyRepo = dataSource.getRepository(SymptomSurvey);
        const survey = await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-01T08:00:00.000Z'),
          totalScore: 0,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        const reassessment = await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-02T08:00:00.000Z'),
          totalScore: 0,
          triageColor: 'YELLOW',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
          source: 'REASSESSMENT',
          nurseNote: 'Bệnh nhân giảm buồn nôn.',
          nurseId: 3,
        });

        const result = await symptomSurveyService.getAssessmentHistory('CASE-001', 1, 10);

        const reassessmentItem = result.data.find(
          (d) => d.assessmentId === reassessment.assessmentId,
        );
        const surveyItem = result.data.find((d) => d.assessmentId === survey.assessmentId);
        expect(reassessmentItem).toEqual(
          expect.objectContaining({
            source: 'REASSESSMENT',
            nurseNote: 'Bệnh nhân giảm buồn nôn.',
            details: [],
          }),
        );
        expect(surveyItem).toEqual(expect.objectContaining({ source: 'SURVEY', nurseNote: null }));
      });
    });

    describe('GIVEN a pagination limit smaller than the total assessment count', () => {
      it('THEN should return a page of that size and the correct total', async () => {
        const surveyRepo = dataSource.getRepository(SymptomSurvey);
        await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-01T08:00:00.000Z'),
          totalScore: 0,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-02T08:00:00.000Z'),
          totalScore: 5,
          triageColor: 'RED',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        const result = await symptomSurveyService.getAssessmentHistory('CASE-001', 1, 1);

        expect(result.data).toHaveLength(1);
        expect(result.total).toBe(2);
      });
    });

    describe('GIVEN a case with no assessments', () => {
      it('THEN should return an empty page with total 0', async () => {
        const result = await symptomSurveyService.getAssessmentHistory('CASE-999', 1, 10);

        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
      });
    });
  });

  describe('submitReassessment()', () => {
    describe('GIVEN a caseId that does not reference an existing patient', () => {
      it('THEN should throw NotFoundException', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-999',
          triageColor: 'RED',
        };

        await expect(symptomSurveyService.submitReassessment(dto, nurseCaller)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('GIVEN a REASSESSMENT with a triage color', () => {
      it('THEN should return an AssessmentHistoryItemDto carrying the reassessment fields and no details', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
          nurseNote: 'Bệnh nhân đau nhiều hơn.',
          source: 'REASSESSMENT',
        };

        const result = await symptomSurveyService.submitReassessment(dto, nurseCaller);

        expect(result).toEqual(
          expect.objectContaining({
            triageColor: 'RED',
            totalScore: 0,
            source: 'REASSESSMENT',
            nurseNote: 'Bệnh nhân đau nhiều hơn.',
            details: [],
          }),
        );
        expect(result.assessmentId).toEqual(expect.any(Number));
      });

      it('THEN should persist the survey row with source, nurseNote, and the caller as nurseId', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
          nurseNote: 'Bệnh nhân đau nhiều hơn.',
          source: 'REASSESSMENT',
        };

        const result = await symptomSurveyService.submitReassessment(dto, nurseCaller);

        const stored = await dataSource
          .getRepository(SymptomSurvey)
          .findOne({ where: { assessmentId: result.assessmentId } });
        expect(stored).toEqual(
          expect.objectContaining({
            caseId: 'CASE-001',
            triageColor: 'RED',
            source: 'REASSESSMENT',
            nurseNote: 'Bệnh nhân đau nhiều hơn.',
            nurseId: nurseCaller.id,
          }),
        );
      });

      it("THEN should sync the patient's level to match the new triage color", async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
        };

        await symptomSurveyService.submitReassessment(dto, nurseCaller);

        const patient = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' }, relations: ['level'] });
        expect(patient?.level?.levelName).toBe('Red');
      });

      it("THEN should ask AlertService to reconcile the case's alerts against the new triage color", async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
        };

        const result = await symptomSurveyService.submitReassessment(dto, nurseCaller);

        expect(alertService.updateAlertsOnReassessment).toHaveBeenCalledTimes(1);
        expect(alertService.updateAlertsOnReassessment).toHaveBeenCalledWith(
          'CASE-001',
          'RED',
          result.assessmentId,
        );
      });

      it('THEN should emit an assessment.submitted statistics event', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
        };

        const result = await symptomSurveyService.submitReassessment(dto, nurseCaller);

        expect(statisticsGateway.emitAssessmentSubmitted).toHaveBeenCalledTimes(1);
        expect(statisticsGateway.emitAssessmentSubmitted).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'CASE-001',
            assessmentId: result.assessmentId,
            triageColor: 'RED',
          }),
        );
      });
    });

    describe('GIVEN a plain NOTE (source=NOTE)', () => {
      it('THEN should force triageColor to null on both the response and the persisted row', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          triageColor: 'RED',
          nurseNote: 'Chỉ ghi chú, không đổi mức độ.',
          source: 'NOTE',
        };

        const result = await symptomSurveyService.submitReassessment(dto, nurseCaller);

        expect(result.triageColor).toBeNull();
        expect(result.source).toBe('NOTE');

        const stored = await dataSource
          .getRepository(SymptomSurvey)
          .findOne({ where: { assessmentId: result.assessmentId } });
        expect(stored?.triageColor).toBeNull();
        expect(stored?.source).toBe('NOTE');
      });

      it('THEN should not sync patient level, reconcile alerts, or emit a statistics event', async () => {
        const dto: CreateReassessmentDto = {
          caseId: 'CASE-001',
          nurseNote: 'Chỉ ghi chú, không đổi mức độ.',
          source: 'NOTE',
        };

        await symptomSurveyService.submitReassessment(dto, nurseCaller);

        expect(alertService.updateAlertsOnReassessment).not.toHaveBeenCalled();
        expect(statisticsGateway.emitAssessmentSubmitted).not.toHaveBeenCalled();
      });
    });
  });
});
