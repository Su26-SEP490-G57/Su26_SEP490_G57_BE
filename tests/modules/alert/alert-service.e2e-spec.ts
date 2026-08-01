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
// the DB persistence side of createAlert stays fully real.
describe('AlertService (integration)', () => {
  let app: INestApplication;
  let alertService: AlertService;
  let alertGateway: DeepMocked<AlertGateway>;
  let dataSource: DataSource;
  let surveyId: number;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    alertGateway = createMock<AlertGateway>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(AlertGateway)
      .useValue(alertGateway)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    alertService = app.get(AlertService);
  });

  beforeEach(async () => {
    await resetTestDataSource();
    alertGateway.emitNewAlert.mockClear();

    const survey = await dataSource
      .getRepository(SymptomSurvey)
      .save({ caseId: 'CASE-001', evaluationDatetime: new Date() });
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
            status: 'Pending',
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
        expect(stored?.status).toBe('Pending');
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
  });
});
