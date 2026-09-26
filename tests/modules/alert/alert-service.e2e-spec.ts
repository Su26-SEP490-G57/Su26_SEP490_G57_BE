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
import { UserResponseDto } from '../../../src/modules/user/dtos/user-response.dto';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// seed.ts assigns nurse01 (user id 3) to room P502, which is where CASE-001's
// patient case is seeded — see the room-assignment comment further below.
const nurse01Caller: UserResponseDto = {
  id: 3,
  username: 'nurse01',
  fullName: 'Trần Thị Thu Hà',
  phoneNumber: null,
  caseId: null,
  roles: [UserRoleName.NURSE],
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

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
    alertGateway.emitAlertHandled.mockClear();
    notificationService.sendToNursesSpecific.mockClear();
    notificationService.sendToNurses.mockClear();
    notificationService.sendToHeadNurses.mockClear();
    notificationService.sendToDoctors.mockClear();
    notificationService.sendToDoctors.mockResolvedValue({ attempted: 0, sent: 0 });

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
          alertType: 'RED',
        });

        expect(result).toEqual(
          expect.objectContaining({
            caseId: 'CASE-001',
            assessmentId: surveyId,
            alertType: 'RED',
            status: 'Đang chờ xử trí',
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
      it('THEN should not attempt to fan out a push notification to specific nurses', async () => {
        const unassignedRoomSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-007',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        await alertService.createAlert({
          caseId: 'CASE-007',
          assessmentId: unassignedRoomSurvey.assessmentId,
          alertType: 'RED',
        });

        expect(notificationService.sendToNursesSpecific).not.toHaveBeenCalled();
      });

      // An unassigned room must not mean the alert silently reaches no one — but
      // it goes to head nurses only: plain nurses not assigned to the room would
      // get a 403 when trying to handle it.
      it('THEN should send the push notification to head nurses only', async () => {
        const unassignedRoomSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-007',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });

        await alertService.createAlert({
          caseId: 'CASE-007',
          assessmentId: unassignedRoomSurvey.assessmentId,
          alertType: 'RED',
        });

        expect(notificationService.sendToNurses).not.toHaveBeenCalled();
        expect(notificationService.sendToHeadNurses).toHaveBeenCalledTimes(1);
        expect(notificationService.sendToHeadNurses).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            caseId: 'CASE-007',
            assessmentId: String(unassignedRoomSurvey.assessmentId),
            alertType: 'RED',
          }),
        );
      });
    });
  });

  describe('updateAlertsOnReassessment()', () => {
    describe('GIVEN a pending alert exists for the case and the new triage color is GREEN', () => {
      it('THEN should mark the alert HANDLED with a resolution note and a handledAt timestamp', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });
        alertGateway.emitNewAlert.mockClear();

        await alertService.updateAlertsOnReassessment('CASE-001', 'GREEN');

        const stored = await dataSource
          .getRepository(Alert)
          .findOne({ where: { alertId: created.alertId } });
        expect(stored).toEqual(
          expect.objectContaining({
            status: 'HANDLED',
            nursingNote: 'Điều dưỡng đã đánh giá lại lâm sàng (phân loại: GREEN).',
          }),
        );
        expect(stored?.handledAt).toBeInstanceOf(Date);
      });

      it('THEN should emit the handled alert over the alert gateway', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });
        alertGateway.emitNewAlert.mockClear();

        await alertService.updateAlertsOnReassessment('CASE-001', 'GREEN');

        expect(alertGateway.emitNewAlert).not.toHaveBeenCalled();
        expect(alertGateway.emitAlertHandled).toHaveBeenCalledTimes(1);
        expect(alertGateway.emitAlertHandled).toHaveBeenCalledWith(
          expect.objectContaining({ alertId: created.alertId, status: 'Đã xử trí' }),
        );
      });
    });

    // Reassessment always closes the pending alerts regardless of the new color;
    // raising a fresh alert for a RED/YELLOW result is SymptomSurveyService's job.
    describe('GIVEN a pending YELLOW alert exists for the case and the new triage color is RED', () => {
      it('THEN should close the existing alert as HANDLED without changing its type', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'YELLOW',
        });

        await alertService.updateAlertsOnReassessment('CASE-001', 'RED', surveyId, 3);

        const alerts = await dataSource
          .getRepository(Alert)
          .find({ where: { caseId: 'CASE-001' } });
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toEqual(
          expect.objectContaining({
            alertId: created.alertId,
            alertType: 'YELLOW',
            status: 'HANDLED',
            handledByUserId: 3,
            nursingNote: 'Điều dưỡng đã đánh giá lại lâm sàng (phân loại: RED).',
          }),
        );
      });
    });

    describe('GIVEN no pending alert exists for the case and the new triage color is RED', () => {
      it('THEN should not create an alert or emit anything', async () => {
        await alertService.updateAlertsOnReassessment('CASE-001', 'RED', surveyId);

        const count = await dataSource
          .getRepository(Alert)
          .count({ where: { caseId: 'CASE-001' } });
        expect(count).toBe(0);
        expect(alertGateway.emitNewAlert).not.toHaveBeenCalled();
        expect(alertGateway.emitAlertHandled).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN no pending alert exists for the case and the new triage color is GREEN', () => {
      it('THEN should not create an alert or emit anything', async () => {
        await alertService.updateAlertsOnReassessment('CASE-001', 'GREEN', surveyId);

        const count = await dataSource
          .getRepository(Alert)
          .count({ where: { caseId: 'CASE-001' } });
        expect(count).toBe(0);
        expect(alertGateway.emitNewAlert).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleAlert()', () => {
    // seed.ts assigns nurse01 (user id 3) to room P502, and CASE-001's patient
    // case is seeded with roomBed 'P502'.
    describe('GIVEN an assigned nurse handles a pending alert', () => {
      it('THEN should emit the handled alert over the alert gateway', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });
        alertGateway.emitNewAlert.mockClear();

        await alertService.handleAlert(created.alertId, nurse01Caller);

        expect(alertGateway.emitAlertHandled).toHaveBeenCalledTimes(1);
        expect(alertGateway.emitAlertHandled).toHaveBeenCalledWith(
          expect.objectContaining({ alertId: created.alertId, status: 'Đã xử trí' }),
        );
      });

      // Kept separate: notifying doctors is an independent side effect from the
      // gateway emit and the persisted HANDLED status.
      it('THEN should notify doctors that the nurse completed handling it', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });

        await alertService.handleAlert(created.alertId, nurse01Caller);

        expect(notificationService.sendToDoctors).toHaveBeenCalledTimes(1);
        expect(notificationService.sendToDoctors).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Nguyễn Văn An'),
          expect.objectContaining({
            caseId: 'CASE-001',
            assessmentId: String(surveyId),
            alertId: String(created.alertId),
            alertType: 'RED',
          }),
        );
      });
    });

    // The doctor-notification fan-out is best-effort: a failure there must not
    // prevent the nurse's handling action itself from succeeding.
    describe('GIVEN notifying doctors fails', () => {
      it('THEN should still resolve with the alert marked HANDLED', async () => {
        notificationService.sendToDoctors.mockRejectedValue(new Error('FCM unavailable'));

        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });

        const result = await alertService.handleAlert(created.alertId, nurse01Caller);

        expect(result).toEqual(
          expect.objectContaining({ alertId: created.alertId, status: 'Đã xử trí' }),
        );
      });
    });

    // Handling used to be restricted to alertType 'RED'; that restriction was
    // lifted so a pending YELLOW alert can also be acknowledged.
    describe('GIVEN a pending YELLOW alert', () => {
      it('THEN should mark it HANDLED', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'YELLOW',
        });

        const result = await alertService.handleAlert(created.alertId, nurse01Caller);

        expect(result.status).toBe('Đã xử trí');
      });
    });
  });

  describe('getDoctorNotifications()', () => {
    describe('GIVEN both a HANDLED and a PENDING_REVIEW alert exist', () => {
      it('THEN should return only the HANDLED alert', async () => {
        const handled = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'RED',
        });
        await alertService.handleAlert(handled.alertId, nurse01Caller);

        await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
          alertType: 'YELLOW',
        });

        const result = await alertService.getDoctorNotifications({});

        expect(result.total).toBe(1);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual(
          expect.objectContaining({ alertId: handled.alertId, status: 'Đã xử trí' }),
        );
      });
    });

    describe('GIVEN no HANDLED alerts exist', () => {
      it('THEN should return an empty page', async () => {
        const result = await alertService.getDoctorNotifications({});

        expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      });
    });
  });

  describe('isAssessmentLocked()', () => {
    it('allows assessment when no RED alert exists', async () => {
      await expect(alertService.isAssessmentLocked('CASE-002')).resolves.toBe(false);
    });

    it('keeps assessment locked while a RED alert is pending', async () => {
      await alertService.createAlert({
        caseId: 'CASE-001',
        assessmentId: surveyId,
        alertType: 'RED',
      });

      await expect(alertService.isAssessmentLocked('CASE-001')).resolves.toBe(true);
    });

    it('keeps assessment locked after handling until the cooldown elapses', async () => {
      const created = await alertService.createAlert({
        caseId: 'CASE-001',
        assessmentId: surveyId,
        alertType: 'RED',
      });
      await alertService.handleAlert(created.alertId, nurse01Caller);

      await expect(alertService.isAssessmentLocked('CASE-001')).resolves.toBe(true);
    });

    it('allows assessment after handling and the cooldown has elapsed', async () => {
      const created = await alertService.createAlert({
        caseId: 'CASE-001',
        assessmentId: surveyId,
        alertType: 'RED',
      });
      await alertService.handleAlert(created.alertId, nurse01Caller);

      const afterCooldown = new Date(created.triggeredAt!.getTime() + 60 * 60 * 1000 + 1);
      await expect(alertService.isAssessmentLocked('CASE-001', afterCooldown)).resolves.toBe(false);
    });

    it('fails safe when a RED alert is missing its trigger timestamp', async () => {
      const created = await alertService.createAlert({
        caseId: 'CASE-001',
        assessmentId: surveyId,
        alertType: 'RED',
      });
      await dataSource
        .getRepository(Alert)
        .update({ alertId: created.alertId }, { triggeredAt: null });

      await expect(alertService.isAssessmentLocked('CASE-001')).resolves.toBe(true);
    });
  });

  describe('findPendingRedByCaseId()', () => {
    describe('GIVEN a PENDING_REVIEW RED alert exists for the case', () => {
      it('THEN should return that alert', async () => {
        const created = await alertService.createAlert({
          caseId: 'CASE-001',
          assessmentId: surveyId,
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
          alertType: 'RED',
        });
        await alertService.handleAlert(created.alertId, nurse01Caller);

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
