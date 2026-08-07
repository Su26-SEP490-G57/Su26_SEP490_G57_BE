import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { AlertGateway } from '../../../src/modules/alert/gateways/alert.gateway';
import { Alert } from '../../../src/modules/alert/entities/alert.entity';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { AssessmentDetail } from '../../../src/modules/symptom-survey/entities/assessment-detail.entity';
import { AssessmentTask } from '../../../src/modules/symptom-survey/entities/assessment-task.entity';
import { QuestionOption } from '../../../src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../../../src/modules/symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import { QuestionOptionDto } from '../../../src/modules/symptom-survey/dtos/survey-question.dto';
import {
  PatientPodTimelineResponseDto,
  SurveyQuestionDto,
  SymptomSurveyResponseDto,
} from '../../../src/modules/symptom-survey/dtos/symptom-survey-response.dto';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

describe('SymptomSurveyController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let alertGateway: DeepMocked<AlertGateway>;

  let nurseToken: string;
  let headNurseToken: string;
  let patientOneToken: string; // patient01, CASE-001
  let patientTwoToken: string; // patient02, CASE-002

  let questionId: number;
  let greenOptionId: number; // scoreValue 0
  let yellowOptionId: number; // scoreValue 2
  let redOptionId: number; // scoreValue 5

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    alertGateway = createMock<AlertGateway>();

    // Feed AppModule the already-connected test DataSource directly instead of
    // letting its TypeOrmModule.forRootAsync factory open its own connection.
    // AlertGateway is overridden because submitSurvey's YELLOW/RED path reaches
    // AlertService#createAlert -> AlertGateway#emitNewAlert, and asserting a real
    // Socket.IO emission would require a socket.io-client connection this harness
    // doesn't set up.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(AlertGateway)
      .useValue(alertGateway)
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
    alertGateway.emitNewAlert.mockClear();

    const loginNurse = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (loginNurse.body as LoginResponse).accessToken;
    const loginHeadNurse = await login(httpServer, UserRoleName.HEAD_NURSE);
    headNurseToken = (loginHeadNurse.body as LoginResponse).accessToken;
    const loginPatientOne = await login(httpServer, UserRoleName.PATIENT);
    patientOneToken = (loginPatientOne.body as LoginResponse).accessToken;
    const loginPatientTwo = await login(httpServer, 'patient02', 'Patient@123');
    patientTwoToken = (loginPatientTwo.body as LoginResponse).accessToken;

    const questionRepo = dataSource.getRepository(SurveyQuestion);
    const optionRepo = dataSource.getRepository(QuestionOption);

    // survey_questions/question_options are seed.ts PROTECTED_TABLES (never
    // truncated, since production reference data must survive re-seeding), so
    // this suite owns clearing + repopulating them itself for isolation.
    await dataSource.createQueryBuilder().delete().from(AssessmentDetail).execute();
    await dataSource.createQueryBuilder().delete().from(QuestionOption).execute();
    await dataSource.createQueryBuilder().delete().from(SurveyQuestion).execute();

    const question = await questionRepo.save({
      questionText: 'Bạn có buồn nôn không?',
      orderNumber: 1,
      isDefault: true,
      questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
    });
    questionId = question.questionId;

    const options = await optionRepo.save([
      { questionId, optionText: 'Không', scoreValue: 0, optionTriageLevel: 'GREEN' },
      { questionId, optionText: 'Trung bình', scoreValue: 2, optionTriageLevel: 'YELLOW' },
      { questionId, optionText: 'Nặng', scoreValue: 5, optionTriageLevel: 'RED' },
    ]);
    greenOptionId = options[0].optionId;
    yellowOptionId = options[1].optionId;
    redOptionId = options[2].optionId;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('GET /symptom-surveys/questions', () => {
    describe('GIVEN questions exist', () => {
      it('THEN should respond 200 with the question and all of its options', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/questions'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as SurveyQuestionDto[];
        expect(body).toHaveLength(1);
        expect(body[0]).toEqual(
          expect.objectContaining({
            questionId,
            questionText: 'Bạn có buồn nôn không?',
            isDefault: true,
          }),
        );
        // The options relation declares no explicit order, so assert membership
        // rather than a specific sequence.
        expect(body[0].options.map((o) => o.optionId).sort((a, b) => a - b)).toEqual(
          [greenOptionId, yellowOptionId, redOptionId].sort((a, b) => a - b),
        );
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/symptom-surveys/questions');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /symptom-surveys/questions/:questionId', () => {
    describe('GIVEN an existing question', () => {
      it('THEN should respond 200 with the question detail', async () => {
        const response = await authed(
          request(httpServer).get(`/symptom-surveys/questions/${questionId}`),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as SurveyQuestionDto).toEqual(
          expect.objectContaining({ questionId, questionText: 'Bạn có buồn nôn không?' }),
        );
      });
    });

    describe('GIVEN the question does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/questions/999999'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /symptom-surveys/questions', () => {
    describe('GIVEN a Head Nurse and a valid body with inline options', () => {
      it('THEN should respond 201 with the created question and its options', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys/questions'),
          headNurseToken,
        ).send({
          questionText: 'Bạn có sốt không?',
          orderNumber: 2,
          isDefault: false,
          options: [
            { optionText: 'Không', scoreValue: 0 },
            { optionText: 'Có', scoreValue: 3 },
          ],
        });

        expect(response.status).toBe(201);
        const body = response.body as SurveyQuestionDto;
        expect(body).toEqual(
          expect.objectContaining({ questionText: 'Bạn có sốt không?', isDefault: false }),
        );
        expect(body.options.map((o) => o.optionText)).toEqual(['Không', 'Có']);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys/questions'),
          nurseToken,
        ).send({ questionText: 'Bạn có sốt không?', isDefault: false });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('PATCH /symptom-surveys/questions/:questionId', () => {
    describe('GIVEN a Head Nurse and an existing question', () => {
      it('THEN should respond 200 with the updated question text', async () => {
        const response = await authed(
          request(httpServer).patch(`/symptom-surveys/questions/${questionId}`),
          headNurseToken,
        ).send({ questionText: 'Bạn có buồn nôn không? (cập nhật)' });

        expect(response.status).toBe(200);
        expect(response.body as SurveyQuestionDto).toEqual(
          expect.objectContaining({
            questionId,
            questionText: 'Bạn có buồn nôn không? (cập nhật)',
          }),
        );
      });
    });

    describe('GIVEN the question does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/symptom-surveys/questions/999999'),
          headNurseToken,
        ).send({ questionText: 'x' });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('DELETE /symptom-surveys/questions/:questionId', () => {
    describe('GIVEN an unused question', () => {
      it('THEN should respond 204 and remove the question', async () => {
        const response = await authed(
          request(httpServer).delete(`/symptom-surveys/questions/${questionId}`),
          headNurseToken,
        );

        expect(response.status).toBe(204);

        const stored = await dataSource
          .getRepository(SurveyQuestion)
          .findOne({ where: { questionId } });
        expect(stored).toBeNull();
      });
    });

    describe('GIVEN the question has already been used in an assessment', () => {
      it('THEN should respond 409 Conflict and keep the question', async () => {
        const survey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(AssessmentDetail).save({
          assessmentId: survey.assessmentId,
          questionId,
          selectedOptionId: greenOptionId,
          scoreEarned: 0,
        });

        const response = await authed(
          request(httpServer).delete(`/symptom-surveys/questions/${questionId}`),
          headNurseToken,
        );

        expect(response.status).toBe(409);

        const stored = await dataSource
          .getRepository(SurveyQuestion)
          .findOne({ where: { questionId } });
        expect(stored).not.toBeNull();
      });
    });
  });

  describe('POST /symptom-surveys/questions/:questionId/options', () => {
    describe('GIVEN a Head Nurse and an existing question', () => {
      it('THEN should respond 201 with the created option', async () => {
        const response = await authed(
          request(httpServer).post(`/symptom-surveys/questions/${questionId}/options`),
          headNurseToken,
        ).send({ optionText: 'Rất nặng', scoreValue: 8 });

        expect(response.status).toBe(201);
        expect(response.body as QuestionOptionDto).toEqual(
          expect.objectContaining({ optionText: 'Rất nặng', scoreValue: 8 }),
        );
      });
    });

    describe('GIVEN the question does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys/questions/999999/options'),
          headNurseToken,
        ).send({ optionText: 'x', scoreValue: 1 });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('PATCH /symptom-surveys/questions/:questionId/options/:optionId', () => {
    describe('GIVEN a Head Nurse and an existing option', () => {
      it('THEN should respond 200 with the updated option', async () => {
        const response = await authed(
          request(httpServer).patch(
            `/symptom-surveys/questions/${questionId}/options/${greenOptionId}`,
          ),
          headNurseToken,
        ).send({ optionText: 'Hoàn toàn không', scoreValue: 0 });

        expect(response.status).toBe(200);
        expect(response.body as QuestionOptionDto).toEqual(
          expect.objectContaining({ optionId: greenOptionId, optionText: 'Hoàn toàn không' }),
        );
      });
    });

    describe('GIVEN the option does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch(`/symptom-surveys/questions/${questionId}/options/999999`),
          headNurseToken,
        ).send({ scoreValue: 1 });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('DELETE /symptom-surveys/questions/:questionId/options/:optionId', () => {
    describe('GIVEN an unused option', () => {
      it('THEN should respond 204 and remove the option', async () => {
        const response = await authed(
          request(httpServer).delete(
            `/symptom-surveys/questions/${questionId}/options/${greenOptionId}`,
          ),
          headNurseToken,
        );

        expect(response.status).toBe(204);

        const stored = await dataSource
          .getRepository(QuestionOption)
          .findOne({ where: { optionId: greenOptionId } });
        expect(stored).toBeNull();
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).delete(
            `/symptom-surveys/questions/${questionId}/options/${greenOptionId}`,
          ),
          patientOneToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN the option has already been used in an assessment', () => {
      it('THEN should respond 409 Conflict and keep the option', async () => {
        const survey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(AssessmentDetail).save({
          assessmentId: survey.assessmentId,
          questionId,
          selectedOptionId: greenOptionId,
          scoreEarned: 0,
        });

        const response = await authed(
          request(httpServer).delete(
            `/symptom-surveys/questions/${questionId}/options/${greenOptionId}`,
          ),
          headNurseToken,
        );

        expect(response.status).toBe(409);

        const stored = await dataSource
          .getRepository(QuestionOption)
          .findOne({ where: { optionId: greenOptionId } });
        expect(stored).not.toBeNull();
      });
    });
  });

  describe('POST /symptom-surveys', () => {
    describe('GIVEN a patient submitting a GREEN-scoring answer for their own case', () => {
      it('THEN should respond 201 with total_score 0 and triage_color GREEN', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: greenOptionId }],
        });

        expect(response.status).toBe(201);
        expect(response.body as SymptomSurveyResponseDto).toEqual(
          expect.objectContaining({ caseId: 'CASE-001', totalScore: 0, triageColor: 'GREEN' }),
        );
      });

      // Kept separate: whether an alert gets auto-generated is an independent
      // system from the submit response shape — GREEN should raise no alert.
      it('THEN should not create an alert', async () => {
        await authed(request(httpServer).post('/symptom-surveys'), patientOneToken).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: greenOptionId }],
        });

        expect(alertGateway.emitNewAlert).not.toHaveBeenCalled();
        const alertCount = await dataSource.getRepository(Alert).count();
        expect(alertCount).toBe(0);
      });
    });

    describe('GIVEN a YELLOW-scoring answer', () => {
      it('THEN should respond 201 with triage_color YELLOW and auto-generate a YELLOW alert', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: yellowOptionId }],
        });

        expect(response.status).toBe(201);
        const body = response.body as SymptomSurveyResponseDto;
        expect(body).toEqual(expect.objectContaining({ triageColor: 'YELLOW' }));

        const alert = await dataSource
          .getRepository(Alert)
          .findOne({ where: { assessmentId: body.assessmentId } });
        expect(alert).toEqual(
          expect.objectContaining({
            caseId: 'CASE-001',
            alertType: 'YELLOW',
            status: 'PENDING_REVIEW',
          }),
        );
      });
    });

    describe('GIVEN a RED-scoring answer', () => {
      it('THEN should respond 201 with triage_color RED and auto-generate a RED alert', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: redOptionId }],
        });

        expect(response.status).toBe(201);
        const body = response.body as SymptomSurveyResponseDto;
        expect(body).toEqual(expect.objectContaining({ triageColor: 'RED' }));

        const alert = await dataSource
          .getRepository(Alert)
          .findOne({ where: { assessmentId: body.assessmentId } });
        expect(alert).toEqual(
          expect.objectContaining({ alertType: 'RED', status: 'PENDING_REVIEW' }),
        );
      });
    });

    describe('GIVEN a patient submitting for a case that is not their own', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-002',
          answers: [{ questionId, selectedOptionId: greenOptionId }],
        });

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN an answer referencing an option id that does not exist', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: 999999 }],
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .post('/symptom-surveys')
          .send({
            caseId: 'CASE-001',
            answers: [{ questionId, selectedOptionId: greenOptionId }],
          });

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN the ERAS protocol has already been completed for the case', () => {
      it('THEN should respond 400 Bad Request', async () => {
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-001' }, { erasCompleted: true });

        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: greenOptionId }],
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a pending RED alert already exists for the case', () => {
      it('THEN should respond 403 Forbidden and not create a new survey', async () => {
        const priorSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(Alert).save({
          caseId: 'CASE-001',
          assessmentId: priorSurvey.assessmentId,
          surveyScore: 14,
          alertType: 'RED',
          status: 'PENDING_REVIEW',
          isAutoProgression: true,
          triggeredAt: new Date(),
        });

        const surveyCountBefore = await dataSource.getRepository(SymptomSurvey).count();

        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId, selectedOptionId: greenOptionId }],
        });

        expect(response.status).toBe(403);
        const surveyCountAfter = await dataSource.getRepository(SymptomSurvey).count();
        expect(surveyCountAfter).toBe(surveyCountBefore);
      });
    });

    describe('GIVEN consecutive vomiting answers accumulate to 2 or more within the same POD', () => {
      let vomitingQuestionId: number;
      let vomitingOptionId: number;

      beforeEach(async () => {
        // CASE-001 sits on POD 2 (see beforeEach seed above) — the accumulation
        // window is scoped to the patient's current POD.
        const vomitingQuestion = await dataSource.getRepository(SurveyQuestion).save({
          questionText: 'Số lần nôn trong ngày?',
          isDefault: true,
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
          clinicalDimension: 'VOMITING',
        });
        vomitingQuestionId = vomitingQuestion.questionId;
        const vomitingOption = await dataSource.getRepository(QuestionOption).save({
          questionId: vomitingQuestion.questionId,
          optionText: '1 lần',
          scoreValue: 0,
          optionTriageLevel: 'GREEN',
          normalizedValue: 1,
        });
        vomitingOptionId = vomitingOption.optionId;

        const priorSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          podContext: 2,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(AssessmentDetail).save({
          assessmentId: priorSurvey.assessmentId,
          questionId: vomitingQuestion.questionId,
          selectedOptionId: vomitingOptionId,
          scoreEarned: 0,
          clinicalDimensionSnapshot: 'VOMITING',
          optionTriageLevelSnapshot: 'GREEN',
          normalizedValueSnapshot: 1,
        });
      });

      it('THEN should force triage_color RED even though the selected option alone is GREEN', async () => {
        const response = await authed(
          request(httpServer).post('/symptom-surveys'),
          patientOneToken,
        ).send({
          caseId: 'CASE-001',
          answers: [{ questionId: vomitingQuestionId, selectedOptionId: vomitingOptionId }],
        });

        expect(response.status).toBe(201);
        expect(response.body as SymptomSurveyResponseDto).toEqual(
          expect.objectContaining({ triageColor: 'RED' }),
        );
      });
    });

    describe('GIVEN an assessmentType of SCHEDULED', () => {
      describe('AND no matching pending task exists', () => {
        it('THEN should respond 400 Bad Request', async () => {
          const response = await authed(
            request(httpServer).post('/symptom-surveys'),
            patientOneToken,
          ).send({
            caseId: 'CASE-001',
            assessmentType: 'SCHEDULED',
            scheduledSlot: 'MORNING',
            answers: [{ questionId, selectedOptionId: greenOptionId }],
          });

          expect(response.status).toBe(400);
        });
      });

      describe('AND the matching task has not opened yet', () => {
        it('THEN should respond 400 Bad Request', async () => {
          const now = new Date();
          await dataSource.getRepository(AssessmentTask).save({
            caseId: 'CASE-001',
            podContext: 2,
            scheduledSlot: 'MORNING',
            opensAt: new Date(now.getTime() + 60 * 60 * 1000),
            closesAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
            status: 'PENDING',
          });

          const response = await authed(
            request(httpServer).post('/symptom-surveys'),
            patientOneToken,
          ).send({
            caseId: 'CASE-001',
            assessmentType: 'SCHEDULED',
            scheduledSlot: 'MORNING',
            answers: [{ questionId, selectedOptionId: greenOptionId }],
          });

          expect(response.status).toBe(400);
        });
      });

      describe('AND the matching task has already closed', () => {
        it('THEN should respond 400 Bad Request', async () => {
          const now = new Date();
          await dataSource.getRepository(AssessmentTask).save({
            caseId: 'CASE-001',
            podContext: 2,
            scheduledSlot: 'MORNING',
            opensAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
            closesAt: new Date(now.getTime() - 60 * 60 * 1000),
            status: 'PENDING',
          });

          const response = await authed(
            request(httpServer).post('/symptom-surveys'),
            patientOneToken,
          ).send({
            caseId: 'CASE-001',
            assessmentType: 'SCHEDULED',
            scheduledSlot: 'MORNING',
            answers: [{ questionId, selectedOptionId: greenOptionId }],
          });

          expect(response.status).toBe(400);
        });
      });

      describe('AND an open, pending task matches the case/POD/slot', () => {
        it('THEN should respond 201, mark the task COMPLETED, and link it to the new survey', async () => {
          const now = new Date();
          const task = await dataSource.getRepository(AssessmentTask).save({
            caseId: 'CASE-001',
            podContext: 2,
            scheduledSlot: 'MORNING',
            opensAt: new Date(now.getTime() - 60 * 60 * 1000),
            closesAt: new Date(now.getTime() + 60 * 60 * 1000),
            status: 'PENDING',
          });

          const response = await authed(
            request(httpServer).post('/symptom-surveys'),
            patientOneToken,
          ).send({
            caseId: 'CASE-001',
            assessmentType: 'SCHEDULED',
            scheduledSlot: 'MORNING',
            answers: [{ questionId, selectedOptionId: yellowOptionId }],
          });

          expect(response.status).toBe(201);
          expect(response.body as SymptomSurveyResponseDto).toEqual(
            expect.objectContaining({ caseId: 'CASE-001', triageColor: 'YELLOW' }),
          );

          const storedTask = await dataSource
            .getRepository(AssessmentTask)
            .findOne({ where: { assessmentTaskId: task.assessmentTaskId } });
          expect(storedTask?.status).toBe('COMPLETED');
          expect(storedTask?.assessmentId).toBe(
            (response.body as SymptomSurveyResponseDto).assessmentId,
          );
        });
      });
    });
  });

  describe('GET /symptom-surveys/:patientId/latest', () => {
    beforeEach(async () => {
      await dataSource.getRepository(SymptomSurvey).save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        totalScore: 0,
        triageColor: 'GREEN',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
    });

    describe('GIVEN a Nurse requesting any patient', () => {
      it('THEN should respond 200 with that patient latest survey', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/CASE-001/latest'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as SymptomSurveyResponseDto).toEqual(
          expect.objectContaining({ caseId: 'CASE-001' }),
        );
      });
    });

    describe('GIVEN a Patient requesting their own case', () => {
      it('THEN should respond 200 with their latest survey', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/CASE-001/latest'),
          patientOneToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as SymptomSurveyResponseDto).toEqual(
          expect.objectContaining({ caseId: 'CASE-001' }),
        );
      });
    });

    describe('GIVEN a Patient requesting another case', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/CASE-001/latest'),
          patientTwoToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN the patient has no surveys', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/CASE-999/latest'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('GET /symptom-surveys/:surveyId', () => {
    let surveyId: number;

    beforeEach(async () => {
      const survey = await dataSource.getRepository(SymptomSurvey).save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        totalScore: 5,
        triageColor: 'RED',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await dataSource.getRepository(AssessmentDetail).save({
        assessmentId: survey.assessmentId,
        questionId,
        selectedOptionId: redOptionId,
        scoreEarned: 5,
      });
      surveyId = survey.assessmentId;
    });

    describe('GIVEN a Nurse requesting an existing survey', () => {
      it('THEN should respond 200 with answer details and a triage recommendation', async () => {
        const response = await authed(
          request(httpServer).get(`/symptom-surveys/${surveyId}`),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as SymptomSurveyResponseDto;
        expect(body).toEqual(
          expect.objectContaining({ assessmentId: surveyId, triageColor: 'RED' }),
        );
        expect(body.details).toEqual([
          expect.objectContaining({ questionId, selectedOptionId: redOptionId, scoreEarned: 5 }),
        ]);
        expect(body.recommendation).toEqual(expect.any(String));
      });
    });

    describe('GIVEN a Patient requesting another case survey', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get(`/symptom-surveys/${surveyId}`),
          patientTwoToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN the survey does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/999999'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('GET /symptom-surveys/patient/:caseId/history', () => {
    beforeEach(async () => {
      // seed.ts inserts one assessment per patient case at its current POD —
      // clear it so these tests fully control which PODs are assessed.
      await dataSource.getRepository(SymptomSurvey).delete({ caseId: 'CASE-001' });
    });

    describe('GIVEN a Nurse requesting an existing case with a mix of assessed and unassessed PODs', () => {
      it('THEN should respond 200 with one timeline entry per POD from 0 up to the current POD', async () => {
        // CASE-001 is seeded with currentPod: 2, so the timeline covers POD 0-2.
        const assessedSurvey = await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          podContext: 0,
          totalScore: 0,
          triageColor: 'GREEN',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        await dataSource.getRepository(AssessmentDetail).save({
          assessmentId: assessedSurvey.assessmentId,
          questionId,
          selectedOptionId: greenOptionId,
          scoreEarned: 0,
        });
        await dataSource.getRepository(SymptomSurvey).save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date(),
          podContext: 1,
          totalScore: 2,
          triageColor: 'YELLOW',
          questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
        });
        // POD 2 (the current POD) is intentionally left unassessed.

        const response = await authed(
          request(httpServer).get('/symptom-surveys/patient/CASE-001/history'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PatientPodTimelineResponseDto;
        expect(body.caseId).toBe('CASE-001');
        expect(body.currentPod).toBe(2);
        expect(body.history.map((h) => h.podNumber)).toEqual([0, 1, 2]);

        expect(body.history[0]).toEqual(
          expect.objectContaining({
            podNumber: 0,
            isAssessed: true,
            triageColor: 'GREEN',
            recoveryStatusTag: 'Hồi phục tốt',
          }),
        );
        expect(body.history[1]).toEqual(
          expect.objectContaining({
            podNumber: 1,
            isAssessed: true,
            triageColor: 'YELLOW',
            recoveryStatusTag: 'Cần theo dõi',
          }),
        );
        expect(body.history[2]).toEqual(
          expect.objectContaining({
            podNumber: 2,
            isAssessed: false,
            assessmentId: null,
            triageColor: null,
            recoveryStatusTag: 'Chưa đánh giá',
          }),
        );
      });
    });

    describe('GIVEN a Patient requesting their own case history', () => {
      it('THEN should respond 200', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/patient/CASE-001/history'),
          patientOneToken,
        );

        expect(response.status).toBe(200);
        expect((response.body as PatientPodTimelineResponseDto).caseId).toBe('CASE-001');
      });
    });

    describe('GIVEN a Patient requesting another case history', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/patient/CASE-001/history'),
          patientTwoToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN the patient does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/symptom-surveys/patient/CASE-999999/history'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });
});
