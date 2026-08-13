import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { AlertGateway } from '../../../src/modules/alert/gateways/alert.gateway';
import { AlertService } from '../../../src/modules/alert/services/alert.service';
import { Alert } from '../../../src/modules/alert/entities/alert.entity';
import { NotificationService } from '../../../src/modules/alert/services/notification.service';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// AlertService#createAlert has no HTTP route of its own — it's invoked internally
// by SymptomSurveyService when a submitted survey crosses an alert threshold — so
// it's exercised here at the service level against a real DB rather than via
// supertest. AlertGateway is mocked because asserting a real Socket.IO emission
// would require a socket.io-client connection this test harness doesn't set up;
// the DB persistence side of createAlert stays fully real, including the real
// RoomNurseAssignmentRepository query against seed.ts's room_nurse_assignments
// rows. NotificationService is mocked so the "fan out to exactly the assigned
// nurse ids" assertions don't depend on real UserDevice/FCM token state.
describe('AlertService (integration)', () => {
  let app: INestApplication;
  let alertService: AlertService;
  let alertGateway: DeepMocked<AlertGateway>;
  let notificationService: DeepMocked<NotificationService>;
  let dataSource: DataSource;
  let surveyId: number;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    alertGateway = createMock<AlertGateway>();
    notificationService = createMock<NotificationService>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(AlertGateway)
      .useValue(alertGateway)
      .overrideProvider(NotificationService)
      .useValue(notificationService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    alertService = app.get(AlertService);
  });

  beforeEach(async () => {
    await resetTestDataSource();
    alertGateway.emitNewAlert.mockClear();
    notificationService.sendToNursesSpecific.mockClear();

    const survey = await dataSource.getRepository(SymptomSurvey).save({
      caseId: 'CASE-001',
      evaluationDatetime: new Date(),
      questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
    });
    surveyId = survey.assessmentId;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('createAlert()', () => {
    describe('GIVEN a valid caseId and assessmentId', () => {
      it('THEN should return a Pending, auto-progressed alert carrying the given score/type', async () => {
        const result = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });

        expect(result).toEqual(
          expect.objectContaining({
            caseId: 'CASE-001',
            assessmentId: surveyId,
            surveyScore: 15,
            alertType: 'RED',
            status: 'PENDING_REVIEW',
            isAutoProgression: true,
            nurseAction: null,
            nursingNote: null,
            closedAt: null,
          }),
        );
        expect(result.triggeredAt).toBeInstanceOf(Date);
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the returned object look right."
      it('THEN should persist the new alert row', async () => {
        const result = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });

        const stored = await dataSource
          .getRepository(Alert)
          .findOne({ where: { alertId: result.alertId } });
        expect(stored).not.toBeNull();
        expect(stored?.status).toBe('PENDING_REVIEW');
        expect(stored?.alertType).toBe('RED');
      });

      // Kept separate: emitting over the gateway is an independent side effect
      // from persistence, not part of the same returned/stored object.
      it('THEN should emit the created alert over the alert gateway', async () => {
        const result = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });

        expect(alertGateway.emitNewAlert).toHaveBeenCalledTimes(1);
        expect(alertGateway.emitNewAlert).toHaveBeenCalledWith(
          expect.objectContaining({ alertId: result.alertId, alertType: 'RED' }),
        );
      });
    });

    describe('GIVEN the assessmentId does not reference an existing survey', () => {
      it('THEN should reject instead of persisting an alert with a dangling reference', async () => {
        await expect(
          alertService.createAlert({
            caseId: 'CASE-001',
            assessmentId: 999999,
            surveyScore: 15,
            alertType: 'RED',
          }),
        ).rejects.toThrow();

        const count = await dataSource.getRepository(Alert).count();
        expect(count).toBe(0);
      });
    });

    // seed.ts assigns nurse01 (user id 3) to room P502, and CASE-001's patient
    // case is seeded with roomBed 'P502' — so this exercises the real
    // RoomNurseAssignmentRepository lookup end to end, not a fabricated fixture.
    describe('GIVEN the case is in a room with an assigned nurse', () => {
      it('THEN should fan out the push notification to exactly the assigned nurse ids', async () => {
        const result = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });

        expect(notificationService.sendToNursesSpecific).toHaveBeenCalledTimes(1);
        expect(notificationService.sendToNursesSpecific).toHaveBeenCalledWith(
          [3],
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            caseId: 'CASE-001',
            assessmentId: String(surveyId),
            patientName: 'Nguyễn Văn An',
            roomBed: 'P502',
            alertType: 'RED',
          }),
        );
        expect(result.caseId).toBe('CASE-001');
      });
    });

    // CASE-007's patient case is seeded with roomBed 'P506', a room seed.ts never
    // assigns a nurse to.
    describe('GIVEN the case is in a room with no assigned nurse', () => {
      it('THEN should not attempt to fan out a push notification', async () => {
        const unassignedRoomSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-007',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        await alertService.createAlert({
          caseId: 'CASE-007',
          assessmentId: unassignedRoomSurvey.assessmentId,
          surveyScore: 15,
          alertType: 'RED',
        });

        expect(notificationService.sendToNursesSpecific).not.toHaveBeenCalled();
      });
    });
  });

  describe('findPendingRedByCaseId()', () => {
    describe('GIVEN a PENDING_REVIEW RED alert exists for the case', () => {
      it('THEN should return that alert', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });

        const found = await alertService.findPendingRedByCaseId('CASE-001');

        expect(found).not.toBeNull();
        expect(found?.alertId).toBe(created.alertId);
        expect(found?.status).toBe('PENDING_REVIEW');
        expect(found?.alertType).toBe('RED');
      });
    });

    describe('GIVEN the case only has a YELLOW alert', () => {
      it('THEN should return null', async () => {
        await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 6,
          alertType: 'YELLOW',
        });

        const found = await alertService.findPendingRedByCaseId('CASE-001');

        expect(found).toBeNull();
      });
    });

    describe('GIVEN the case only has a HANDLED RED alert', () => {
      it('THEN should return null', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          surveyScore: 15,
          alertType: 'RED',
        });
        await alertService.acknowledgeAlert(created.alertId, {});

        const found = await alertService.findPendingRedByCaseId('CASE-001');

        expect(found).toBeNull();
      });
    });

    describe('GIVEN no alerts exist for the case', () => {
      it('THEN should return null', async () => {
        const found = await alertService.findPendingRedByCaseId('CASE-002');

        expect(found).toBeNull();
      });
    });
  });
});
