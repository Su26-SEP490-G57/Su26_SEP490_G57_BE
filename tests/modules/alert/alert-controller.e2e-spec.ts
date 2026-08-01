import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import {
  AlertResponseDto,
  PaginatedAlertsDto,
} from '../../../src/modules/alert/dtos/alert-response.dto';
import { Alert } from '../../../src/modules/alert/entities/alert.entity';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

describe('AlertController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let nurseToken: string;

  let pendingYellowAlertId: number;
  let pendingRedAlertId: number;
  let acknowledgedAlertId: number;

  beforeAll(async () => {
    dataSource = await getTestDataSource();

    // Feed AppModule the already-connected test DataSource directly instead of
    // letting its TypeOrmModule.forRootAsync factory open its own connection.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new TimezoneInterceptor());
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetTestDataSource();

    const loginResponse = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (loginResponse.body as LoginResponse).accessToken;

    // Alerts require a real symptom-survey row for their assessment_id FK, and a
    // real patient case for their case_id FK — neither is part of seed.ts, so
    // both are inserted directly here.
    const surveyRepo = dataSource.getRepository(SymptomSurvey);
    const alertRepo = dataSource.getRepository(Alert);

    const surveyOne = await surveyRepo.save({ caseId: 'CASE-001', evaluationDatetime: new Date() });
    const surveyTwo = await surveyRepo.save({ caseId: 'CASE-002', evaluationDatetime: new Date() });

    const pendingYellow = await alertRepo.save({
      caseId: 'CASE-001',
      assessmentId: surveyOne.assessmentId,
      surveyScore: 6,
      alertType: 'YELLOW',
      status: 'Pending',
      isAutoProgression: true,
      triggeredAt: new Date('2026-07-20T08:00:00.000Z'),
    });
    const pendingRed = await alertRepo.save({
      caseId: 'CASE-001',
      assessmentId: surveyOne.assessmentId,
      surveyScore: 14,
      alertType: 'RED',
      status: 'Pending',
      isAutoProgression: true,
      triggeredAt: new Date('2026-07-21T08:00:00.000Z'),
    });
    const acknowledged = await alertRepo.save({
      caseId: 'CASE-002',
      assessmentId: surveyTwo.assessmentId,
      surveyScore: 10,
      alertType: 'RED',
      status: 'Acknowledged',
      isAutoProgression: false,
      triggeredAt: new Date('2026-07-19T08:00:00.000Z'),
      nurseAction: 'Đã theo dõi thêm',
      nursingNote: 'Bệnh nhân ổn định.',
    });

    pendingYellowAlertId = pendingYellow.alertId;
    pendingRedAlertId = pendingRed.alertId;
    acknowledgedAlertId = acknowledged.alertId;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('GET /alerts', () => {
    describe('GIVEN no filters', () => {
      it('THEN should respond 200 with all seeded alerts, newest triggeredAt first', async () => {
        const response = await authed(request(httpServer).get('/alerts'), nurseToken);

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAlertsDto;
        expect(body.total).toBe(3);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(10);
        expect(body.data.map((a) => a.alertId)).toEqual([
          pendingRedAlertId,
          pendingYellowAlertId,
          acknowledgedAlertId,
        ]);
      });
    });

    describe('GIVEN a caseId filter', () => {
      it('THEN should respond 200 with only alerts for that case', async () => {
        const response = await authed(
          request(httpServer).get('/alerts').query({ caseId: 'CASE-002' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAlertsDto;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(
          expect.objectContaining({ alertId: acknowledgedAlertId, caseId: 'CASE-002' }),
        );
      });
    });

    describe('GIVEN a status filter', () => {
      it('THEN should respond 200 with only alerts in that status', async () => {
        const response = await authed(
          request(httpServer).get('/alerts').query({ status: 'Acknowledged' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAlertsDto;
        expect(body.total).toBe(1);
        expect(body.data[0].alertId).toBe(acknowledgedAlertId);
      });
    });

    describe('GIVEN an alertType filter', () => {
      it('THEN should respond 200 with only alerts of that type', async () => {
        const response = await authed(
          request(httpServer).get('/alerts').query({ alertType: 'RED' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAlertsDto;
        expect(body.total).toBe(2);
        expect(body.data.every((a) => a.alertType === 'RED')).toBe(true);
      });
    });

    describe('GIVEN a pagination limit smaller than the total alert count', () => {
      it('THEN should respond 200 with a page of that size and the correct total', async () => {
        const response = await authed(
          request(httpServer).get('/alerts').query({ page: 1, limit: 2 }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAlertsDto;
        expect(body.data).toHaveLength(2);
        expect(body.total).toBe(3);
      });
    });

    describe('GIVEN an unrecognized status value', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).get('/alerts').query({ status: 'NotAStatus' }),
          nurseToken,
        );

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/alerts');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /alerts/:id/acknowledge', () => {
    describe('GIVEN a pending alert and a nurseAction/nursingNote body', () => {
      it('THEN should respond 200 with the alert marked Acknowledged and the notes attached', async () => {
        const response = await authed(
          request(httpServer).patch(`/alerts/${pendingYellowAlertId}/acknowledge`),
          nurseToken,
        ).send({ nurseAction: 'Đo lại sinh hiệu', nursingNote: 'Đã xử trí theo phác đồ.' });

        expect(response.status).toBe(200);
        expect(response.body as AlertResponseDto).toEqual(
          expect.objectContaining({
            alertId: pendingYellowAlertId,
            status: 'Acknowledged',
            nurseAction: 'Đo lại sinh hiệu',
            nursingNote: 'Đã xử trí theo phác đồ.',
          }),
        );
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the Acknowledged status and notes', async () => {
        await authed(
          request(httpServer).patch(`/alerts/${pendingYellowAlertId}/acknowledge`),
          nurseToken,
        ).send({ nurseAction: 'Đo lại sinh hiệu', nursingNote: 'Đã xử trí theo phác đồ.' });

        const stored = await dataSource
          .getRepository(Alert)
          .findOne({ where: { alertId: pendingYellowAlertId } });
        expect(stored?.status).toBe('Acknowledged');
        expect(stored?.nurseAction).toBe('Đo lại sinh hiệu');
        expect(stored?.nursingNote).toBe('Đã xử trí theo phác đồ.');
      });
    });

    describe('GIVEN an empty body', () => {
      it('THEN should respond 200 with the alert Acknowledged and nurseAction/nursingNote left unset', async () => {
        const response = await authed(
          request(httpServer).patch(`/alerts/${pendingYellowAlertId}/acknowledge`),
          nurseToken,
        ).send({});

        expect(response.status).toBe(200);
        expect(response.body as AlertResponseDto).toEqual(
          expect.objectContaining({
            alertId: pendingYellowAlertId,
            status: 'Acknowledged',
            nurseAction: null,
            nursingNote: null,
          }),
        );
      });
    });

    describe('GIVEN an alert id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/alerts/999999/acknowledge'),
          nurseToken,
        ).send({});

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN nurseAction exceeds the 100-character limit', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch(`/alerts/${pendingYellowAlertId}/acknowledge`),
          nurseToken,
        ).send({ nurseAction: 'a'.repeat(101) });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch(`/alerts/${pendingYellowAlertId}/acknowledge`)
          .send({});

        expect(response.status).toBe(401);
      });
    });
  });
});
