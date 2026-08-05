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
import { Alert } from '../../../src/modules/alert/entities/alert.entity';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../../../src/modules/patient/entities/pod-protocol-tracking-log.entity';
import { AnalyticsOverviewResponseDto } from '../../../src/modules/statistics/dtos/analytics-overview-response.dto';
import { AssessmentMatrixResponseDto } from '../../../src/modules/statistics/dtos/assessment-matrix-response.dto';
import { PatientComplianceResponseDto } from '../../../src/modules/statistics/dtos/patient-compliance-response.dto';
import { RecoveryMatrixResponseDto } from '../../../src/modules/statistics/dtos/recovery-matrix-response.dto';
import { AppEngagementLog } from '../../../src/modules/statistics/entities/app-engagement-log.entity';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { AssessmentDetail } from '../../../src/modules/symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from '../../../src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../../../src/modules/symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

describe('StatisticsController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let nurseToken: string;
  let patientToken: string;

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

    const loginNurse = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (loginNurse.body as LoginResponse).accessToken;
    const loginPatient = await login(httpServer, UserRoleName.PATIENT);
    patientToken = (loginPatient.body as LoginResponse).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('GET /patients/analytics/overview', () => {
    let questionId: number;

    beforeEach(async () => {
      // seed.ts creates one assessment per seeded patient case (pod_context =
      // currentPod, no answer details), which would otherwise pollute this
      // suite's own per-POD/compliance counts. survey_questions/question_options
      // are seed.ts PROTECTED_TABLES (never truncated), so this suite owns
      // clearing + repopulating them itself.
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
      const [greenOption, yellowOption, redOption] = await dataSource
        .getRepository(QuestionOption)
        .save([
          { questionId, optionText: 'Không', scoreValue: 0 },
          { questionId, optionText: 'Trung bình', scoreValue: 2 },
          { questionId, optionText: 'Nặng', scoreValue: 5 },
        ]);

      const surveyRepo = dataSource.getRepository(SymptomSurvey);
      const detailRepo = dataSource.getRepository(AssessmentDetail);

      // CASE-001 (room P502, currentPod 2): an assessment at every POD 0..2
      // -> actual 3 / expected 3 = 1.0, compliant.
      const c1p0 = await surveyRepo.save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        podContext: 0,
        totalScore: 0,
        triageColor: 'GREEN',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await detailRepo.save({
        assessmentId: c1p0.assessmentId,
        questionId,
        selectedOptionId: greenOption.optionId,
        scoreEarned: 0,
      });
      const c1p1 = await surveyRepo.save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        podContext: 1,
        totalScore: 5,
        triageColor: 'RED',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await detailRepo.save({
        assessmentId: c1p1.assessmentId,
        questionId,
        selectedOptionId: redOption.optionId,
        scoreEarned: 5,
      });
      const c1p2 = await surveyRepo.save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        podContext: 2,
        totalScore: 2,
        triageColor: 'YELLOW',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await detailRepo.save({
        assessmentId: c1p2.assessmentId,
        questionId,
        selectedOptionId: yellowOption.optionId,
        scoreEarned: 2,
      });

      // CASE-002 (room P502, currentPod 1): only a POD0 assessment -> actual
      // 1 / expected 2 = 0.5, non-compliant.
      const c2p0 = await surveyRepo.save({
        caseId: 'CASE-002',
        evaluationDatetime: new Date(),
        podContext: 0,
        totalScore: 2,
        triageColor: 'YELLOW',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await detailRepo.save({
        assessmentId: c2p0.assessmentId,
        questionId,
        selectedOptionId: yellowOption.optionId,
        scoreEarned: 2,
      });

      // CASE-003 (room P502, currentPod 3): ERAS not started.
      await dataSource
        .getRepository(Patient)
        .update({ caseId: 'CASE-003' }, { podStartDate: null });

      // CASE-004 (room P502, currentPod 2, podStartDate seeded): ERAS started
      // but no assessments at all after the table wipe above -> actual 0 /
      // expected 3 = 0, non-compliant.
    });

    describe('GIVEN a room filter matching a 4-patient cohort with mixed compliance', () => {
      it('THEN should respond 200 with the zero-filled symptom trend and compliance breakdown', async () => {
        const response = await authed(
          request(httpServer).get('/patients/analytics/overview').query({ room: 'P502' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as AnalyticsOverviewResponseDto;
        expect(body.filters).toEqual({ room: 'P502' });
        expect(body.patientCount).toBe(4);
        expect(body.maxPod).toBe(3);
        expect(body.compliance).toEqual({
          compliant: 1,
          nonCompliant: 2,
          notStarted: 1,
          total: 4,
          complianceRate: 1 / 3,
          threshold: 0.8,
        });
        expect(body.symptomTrend).toEqual([
          {
            pod: 0,
            questions: [{ questionId, questionKey: 'nausea', avgScore: 1 }],
            avgTotalScore: 1,
            assessmentCount: 2,
            patientCount: 2,
            redCount: 0,
            yellowCount: 1,
            greenCount: 1,
          },
          {
            pod: 1,
            questions: [{ questionId, questionKey: 'nausea', avgScore: 5 }],
            avgTotalScore: 5,
            assessmentCount: 1,
            patientCount: 1,
            redCount: 1,
            yellowCount: 0,
            greenCount: 0,
          },
          {
            pod: 2,
            questions: [{ questionId, questionKey: 'nausea', avgScore: 2 }],
            avgTotalScore: 2,
            assessmentCount: 1,
            patientCount: 1,
            redCount: 0,
            yellowCount: 1,
            greenCount: 0,
          },
          {
            pod: 3,
            questions: [{ questionId, questionKey: 'nausea', avgScore: 0 }],
            avgTotalScore: 0,
            assessmentCount: 0,
            patientCount: 0,
            redCount: 0,
            yellowCount: 0,
            greenCount: 0,
          },
        ]);
      });
    });

    describe('GIVEN an unrecognized level filter value', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).get('/patients/analytics/overview').query({ level: 'NotALevel' }),
          nurseToken,
        );

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a caller without the Nurse/Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/patients/analytics/overview'),
          patientToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/analytics/overview');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /patients/:caseId/recovery-matrix', () => {
    beforeEach(async () => {
      const trackingRepo = dataSource.getRepository(PodProtocolTrackingLog);
      await trackingRepo.save({
        caseId: 'CASE-001',
        podNumber: 1,
        oldStatus: 'Active',
        newStatus: 'Held',
        actionType: 'Nurse_Pause',
        holdReason: 'Đau bụng nhiều',
      });
      await trackingRepo.save({
        caseId: 'CASE-001',
        podNumber: 1,
        oldStatus: 'Held',
        newStatus: 'Active',
        actionType: 'Nurse_Rollback',
      });

      const survey = await dataSource.getRepository(SymptomSurvey).save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await dataSource.getRepository(Alert).save([
        {
          caseId: 'CASE-001',
          assessmentId: survey.assessmentId,
          surveyScore: 15,
          alertType: 'RED',
          triggeredAt: new Date(),
        },
        {
          caseId: 'CASE-001',
          assessmentId: survey.assessmentId,
          surveyScore: 6,
          alertType: 'YELLOW',
          triggeredAt: new Date(),
        },
      ]);
    });

    describe('GIVEN a patient with hold/rollback history and alerts', () => {
      it('THEN should respond 200 with the recovery matrix summary', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/recovery-matrix'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as RecoveryMatrixResponseDto;
        expect(body).toEqual(
          expect.objectContaining({
            caseId: 'CASE-001',
            fullName: 'Nguyễn Văn An',
            roomBed: 'P502',
            currentPod: 2,
            level: { id: 2, name: 'Yellow' },
            operationType: { id: 2, name: 'Phẫu thuật đại trực tràng' },
          }),
        );
        expect(body.summary).toEqual(
          expect.objectContaining({
            isDischarged: false,
            holdCount: 1,
            rollbackCount: 1,
            currentlyOnHold: false,
            lastHoldReason: 'Đau bụng nhiều',
            redAlertCount: 1,
            yellowAlertCount: 1,
            erasCompleted: false,
          }),
        );
        expect(body.summary.totalPodDays).toEqual(expect.any(Number));
      });
    });

    describe('GIVEN the patient does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-999/recovery-matrix'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Nurse/Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/recovery-matrix'),
          patientToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/CASE-001/recovery-matrix');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /patients/:caseId/compliance', () => {
    beforeEach(async () => {
      await dataSource.getRepository(AppEngagementLog).save({
        caseId: 'CASE-001',
        viewedGuidance: true,
        viewedEducation: false,
        reminderCount: 5,
        appAccessCount: 12,
      });
    });

    describe('GIVEN a patient with an engagement log and one seeded assessment below the compliance threshold', () => {
      it('THEN should respond 200 with the compliance breakdown', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/compliance'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as PatientComplianceResponseDto).toEqual({
          caseId: 'CASE-001',
          currentPod: 2,
          hasEngagementLog: true,
          viewedGuidance: true,
          viewedEducation: false,
          reminderCount: 5,
          appAccessCount: 12,
          // seed.ts saves exactly one assessment per patient case, at pod_context = currentPod.
          assessmentCompletedCount: 1,
          expectedAssessmentCount: 3,
          complianceRate: 1 / 3,
          isCompliant: false,
        });
      });
    });

    describe('GIVEN the patient does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-999/compliance'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Nurse/Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/compliance'),
          patientToken,
        );

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /patients/:caseId/assessment-matrix', () => {
    let questionId: number;
    let optionId: number;

    beforeEach(async () => {
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

      const survey = await dataSource.getRepository(SymptomSurvey).save({
        caseId: 'CASE-001',
        evaluationDatetime: new Date(),
        podContext: 1,
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });
      await dataSource.getRepository(AssessmentDetail).save({
        assessmentId: survey.assessmentId,
        questionId,
        selectedOptionId: optionId,
        scoreEarned: 5,
      });
    });

    describe('GIVEN a patient answered at only one of its current PODs', () => {
      it('THEN should respond 200 with a submitted cell for that POD and unsubmitted cells elsewhere', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/assessment-matrix'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as AssessmentMatrixResponseDto;
        expect(body.caseId).toBe('CASE-001');
        expect(body.currentPod).toBe(2);
        expect(body.pods).toEqual([0, 1, 2]);
        expect(body.unassignedAssessmentCount).toBe(0);

        const question = body.questions.find((q) => q.questionId === questionId);
        expect(question).toBeDefined();
        expect(question?.cells).toEqual([
          { pod: 0, submitted: false, score: null, optionText: null },
          { pod: 1, submitted: true, score: 5, optionText: 'Nặng' },
          { pod: 2, submitted: false, score: null, optionText: null },
        ]);
      });
    });

    describe('GIVEN the patient does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-999/assessment-matrix'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/CASE-001/assessment-matrix');

        expect(response.status).toBe(401);
      });
    });
  });
});
