import 'dotenv/config';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { AssessmentMatrixResponseDto } from '../../../src/modules/statistics/dtos/assessment-matrix-response.dto';
import { AssessmentSubmittedEvent } from '../../../src/modules/statistics/gateways/statistics.gateway';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { AssessmentDetail } from '../../../src/modules/symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from '../../../src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../../../src/modules/symptom-survey/entities/survey-question.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

interface SubmitSurveyResponseBody {
  assessmentId: number;
}

// Covers the fix for the "Statistics page doesn't update without a manual
// refresh" bug: submitting a symptom survey must broadcast
// 'assessment.submitted' on the /statistics socket.io namespace, and the
// statistics REST endpoints must already reflect the new data (the frontend
// invalidates its cache off this event instead of polling). A real
// socket.io-client connection is used deliberately here, rather than mocking
// StatisticsGateway (the convention elsewhere in this suite, e.g.
// symptom-survey-controller.e2e-spec.ts's AlertGateway mock) — the regression
// this test guards against is the wiring itself, i.e. that the emit actually
// reaches a client subscribed to the right namespace.
describe('Statistics realtime (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let baseUrl: string;
  let patientToken: string;
  let nurseToken: string;
  let socket: Socket;
  let questionId: number;
  let optionId: number;

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
    // A real HTTP server listening on a real port is required so socket.io-client
    // can open an actual WebSocket connection to it.
    await app.listen(0);

    httpServer = app.getHttpServer() as Server;
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await resetTestDataSource();

    const loginPatient = await login(httpServer, UserRoleName.PATIENT);
    patientToken = (loginPatient.body as LoginResponse).accessToken;
    const loginNurse = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (loginNurse.body as LoginResponse).accessToken;

    // survey_questions/question_options are seed.ts PROTECTED_TABLES (never
    // truncated), so this suite owns clearing + repopulating them itself.
    await dataSource.createQueryBuilder().delete().from(AssessmentDetail).execute();
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
      .save({ questionId, optionText: 'Không', scoreValue: 0 });
    optionId = option.optionId;
  });

  afterEach(() => {
    socket?.disconnect();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('POST /symptom-surveys', () => {
    describe('GIVEN a client subscribed to the /statistics namespace', () => {
      it('THEN should emit assessment.submitted carrying the new caseId/assessmentId', async () => {
        socket = io(`${baseUrl}/statistics`, { transports: ['websocket'] });
        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          socket.on('connect_error', reject);
        });

        const eventPromise = new Promise<AssessmentSubmittedEvent>((resolve) => {
          socket.on('assessment.submitted', (payload: AssessmentSubmittedEvent) =>
            resolve(payload),
          );
        });

        const submitRes = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientToken,
        ).send({ caseId: 'CASE-001', answers: [{ questionId, selectedOptionId: optionId }] });
        expect(submitRes.status).toBe(201);
        const submitBody = submitRes.body as SubmitSurveyResponseBody;

        const event = await Promise.race([
          eventPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out waiting for assessment.submitted')), 5000),
          ),
        ]);

        expect(event).toEqual(
          expect.objectContaining({ caseId: 'CASE-001', assessmentId: submitBody.assessmentId }),
        );
      });

      // Kept separate from the socket-event assertion above: this verifies the
      // REST read side already reflects the new submission, a different
      // system from "was the event emitted."
      it('THEN the assessment matrix should already reflect the new submission', async () => {
        const submitRes = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientToken,
        ).send({ caseId: 'CASE-001', answers: [{ questionId, selectedOptionId: optionId }] });
        expect(submitRes.status).toBe(201);

        const matrixRes = await authed(
          request(httpServer).get('/patients/CASE-001/assessment-matrix'),
          nurseToken,
        );

        expect(matrixRes.status).toBe(200);
        const matrixBody = matrixRes.body as AssessmentMatrixResponseDto;
        const submittedCells = matrixBody.questions
          .flatMap((q) => q.cells)
          .filter((c) => c.submitted);
        expect(submittedCells.length).toBeGreaterThan(0);
      });
    });
  });
});
