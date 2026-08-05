import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { SymptomSurveyService } from '../../../src/modules/symptom-survey/services/symptom-survey.service';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from '../../../src/modules/symptom-survey/constants/questionnaire-version.constant';
import { AssessmentDetail } from '../../../src/modules/symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from '../../../src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../../../src/modules/symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from '../../../src/modules/symptom-survey/entities/symptom-survey.entity';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// SymptomSurveyService#getAssessmentHistory has no route on SymptomSurveyController
// itself — it's exposed via PatientController's GET /patients/:id/history — so it's
// exercised here directly against the real DB rather than via supertest against a
// route that belongs to a different module.
describe('SymptomSurveyService (integration)', () => {
  let app: INestApplication;
  let symptomSurveyService: SymptomSurveyService;
  let dataSource: DataSource;
  let questionId: number;
  let optionId: number;

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
    symptomSurveyService = app.get(SymptomSurveyService);
  });

  beforeEach(async () => {
    await resetTestDataSource();

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
        });
        const newer = await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-02T08:00:00.000Z'),
          totalScore: 5,
          triageColor: 'RED',
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
        });
        await surveyRepo.save({
          caseId: 'CASE-001',
          evaluationDatetime: new Date('2026-07-02T08:00:00.000Z'),
          totalScore: 5,
          triageColor: 'RED',
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
});
