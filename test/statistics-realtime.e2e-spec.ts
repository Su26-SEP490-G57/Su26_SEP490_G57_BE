// Must load before any other import: several providers (e.g. AuthService)
// read process.env.JWT_ACCESS_SECRET into a module-level const at require
// time, same as src/main.ts does in production.
import 'dotenv/config';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CaseTransformInterceptor } from '../src/common/interceptors/case-transform.interceptor';
import { TimezoneInterceptor } from '../src/common/interceptors/timezone.interceptor';

interface LoginResponseBody {
  accessToken: string;
}

interface QuestionDto {
  questionId: number;
  options: Array<{ optionId: number }>;
}

interface SubmitSurveyResponseBody {
  assessmentId: number;
}

interface AssessmentSubmittedEvent {
  caseId: string;
  assessmentId: number;
}

interface AssessmentMatrixResponseBody {
  questions: Array<{ cells: Array<{ submitted: boolean }> }>;
}

// Covers the fix for the "Statistics page doesn't update without a manual
// refresh" bug: submitting a symptom survey must broadcast
// 'assessment.submitted' on the /statistics socket.io namespace, and the
// statistics REST endpoints must already reflect the new data (the frontend
// invalidates its cache off this event instead of polling).
describe('Statistics realtime (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let patientToken: string;
  let headNurseToken: string;
  let socket: Socket;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new TimezoneInterceptor(), new CaseTransformInterceptor());
    await app.init();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const patientLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'patient01', password: 'Patient@123' })
      .expect(201);
    patientToken = (patientLogin.body as LoginResponseBody).accessToken;

    const nurseLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'head_nurse', password: 'Nurse@123' })
      .expect(201);
    headNurseToken = (nurseLogin.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    socket?.disconnect();
    await app.close();
  });

  it('emits assessment.submitted over /statistics and the assessment matrix reflects the new submission', async () => {
    socket = io(`${baseUrl}/statistics`, { transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const eventPromise = new Promise<AssessmentSubmittedEvent>((resolve) => {
      socket.on('assessment.submitted', (payload: AssessmentSubmittedEvent) => resolve(payload));
    });

    const questionsRes = await request(app.getHttpServer())
      .get('/symptom-surveys/questions')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const answers = (questionsRes.body as QuestionDto[]).map((q) => ({
      questionId: q.questionId,
      selectedOptionId: q.options[0].optionId,
    }));

    const submitRes = await request(app.getHttpServer())
      .post('/symptom-surveys')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ caseId: 'CASE-001', answers })
      .expect(201);
    const submitBody = submitRes.body as SubmitSurveyResponseBody;

    const event = await Promise.race([
      eventPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for assessment.submitted')), 5000),
      ),
    ]);

    expect(event.caseId).toBe('CASE-001');
    expect(event.assessmentId).toBe(submitBody.assessmentId);

    const matrixRes = await request(app.getHttpServer())
      .get('/patients/CASE-001/assessment-matrix')
      .set('Authorization', `Bearer ${headNurseToken}`)
      .expect(200);

    const matrixBody = matrixRes.body as AssessmentMatrixResponseBody;
    const submittedCells = matrixBody.questions.flatMap((q) => q.cells).filter((c) => c.submitted);
    expect(submittedCells.length).toBeGreaterThan(0);
  });
});
