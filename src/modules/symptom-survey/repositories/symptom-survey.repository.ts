import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from '../../patient/entities/level.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { SurveyQuestion } from '../entities/survey-question.entity';
import { SymptomSurvey } from '../entities/symptom-survey.entity';

const TRIAGE_TO_LEVEL_NAME: Record<string, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
};

@Injectable()
export class SymptomSurveyRepository {
  [x: string]: any;
  constructor(
    @InjectRepository(SymptomSurvey)
    private readonly surveyRepo: Repository<SymptomSurvey>,
    @InjectRepository(AssessmentDetail)
    private readonly detailRepo: Repository<AssessmentDetail>,
    @InjectRepository(SurveyQuestion)
    private readonly questionRepo: Repository<SurveyQuestion>,
    @InjectRepository(QuestionOption)
    private readonly optionRepo: Repository<QuestionOption>,
    @InjectRepository(Level)
    private readonly levelRepo: Repository<Level>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  saveSurvey(survey: Partial<SymptomSurvey>): Promise<SymptomSurvey> {
    return this.surveyRepo.save(survey as SymptomSurvey);
  }

  saveDetails(details: Partial<AssessmentDetail>[]): Promise<AssessmentDetail[]> {
    return this.detailRepo.save(details as AssessmentDetail[]);
  }

  findOptionsByIds(ids: number[]): Promise<QuestionOption[]> {
    return this.optionRepo.findByIds(ids);
  }

  findLatestByPatient(caseId: string): Promise<SymptomSurvey | null> {
    return this.surveyRepo.findOne({
      where: { case_id: caseId },
      order: { evaluation_datetime: 'DESC' },
    });
  }

  findAllByPatient(
    caseId: string,
    page: number,
    limit: number,
  ): Promise<[SymptomSurvey[], number]> {
    return this.surveyRepo.findAndCount({
      where: { case_id: caseId },
      order: { evaluation_datetime: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findCurrentPod(caseId: string): Promise<number | null> {
    const patient = await this.patientRepo.findOne({
      where: { case_id: caseId },
      select: ['current_pod'],
    });
    return patient?.current_pod ?? null;
  }

  async syncPatientLevel(caseId: string, triageColor: string): Promise<void> {
    console.log(`[syncPatientLevel] START - caseId: ${caseId}, triageColor: ${triageColor}`);

    const levelName = TRIAGE_TO_LEVEL_NAME[triageColor];
    console.log(`[syncPatientLevel] levelName from mapping: ${levelName}`);

    if (!levelName) {
      console.log(`[syncPatientLevel] ERROR - No levelName found for triageColor: ${triageColor}`);
      return;
    }

    const level = await this.levelRepo.findOne({
      where: { level_name: levelName as 'Red' | 'Yellow' | 'Green' },
    });
    console.log(`[syncPatientLevel] Found level:`, JSON.stringify(level));

    if (!level) {
      console.log(
        `[syncPatientLevel] ERROR - Level not found in database for levelName: ${levelName}`,
      );
      return;
    }

    console.log(
      `[syncPatientLevel] Attempting update - caseId: ${caseId}, level_id: ${level.level_id}`,
    );
    const result = await this.patientRepo.update({ case_id: caseId }, { level_id: level.level_id });
    console.log(
      `[syncPatientLevel] Update result - affected: ${result.affected}, raw: ${JSON.stringify(result.raw)}`,
    );

    if (result.affected === 0) {
      console.log(
        `[syncPatientLevel] WARNING - No rows updated. Patient with caseId ${caseId} may not exist`,
      );
    } else {
      console.log(`[syncPatientLevel] SUCCESS - Updated ${result.affected} row(s)`);
    }
  }

  findById(assessmentId: number): Promise<SymptomSurvey | null> {
    return this.surveyRepo.findOne({ where: { assessment_id: assessmentId } });
  }

  findDetailsById(assessmentId: number): Promise<AssessmentDetail[]> {
    return this.detailRepo.find({
      where: { assessment_id: assessmentId },
      relations: ['question', 'selected_option'],
    });
  }

  findAllQuestions(): Promise<SurveyQuestion[]> {
    return this.questionRepo.find({ order: { order_number: 'ASC' } });
  }

  findQuestionById(questionId: number): Promise<SurveyQuestion | null> {
    return this.questionRepo.findOne({ where: { question_id: questionId } });
  }

  saveQuestion(data: Partial<SurveyQuestion>): Promise<SurveyQuestion> {
    return this.questionRepo.save(data as SurveyQuestion);
  }

  async deleteQuestion(questionId: number): Promise<void> {
    await this.questionRepo.delete({ question_id: questionId });
  }

  countDetailsByQuestion(questionId: number): Promise<number> {
    return this.detailRepo.count({ where: { question_id: questionId } });
  }

  findOptionById(optionId: number): Promise<QuestionOption | null> {
    return this.optionRepo.findOne({ where: { option_id: optionId } });
  }

  saveOption(data: Partial<QuestionOption>): Promise<QuestionOption> {
    return this.optionRepo.save(data as QuestionOption);
  }

  saveOptions(data: Partial<QuestionOption>[]): Promise<QuestionOption[]> {
    return this.optionRepo.save(data as QuestionOption[]);
  }

  async deleteOption(optionId: number): Promise<void> {
    await this.optionRepo.delete({ option_id: optionId });
  }

  countDetailsByOption(optionId: number): Promise<number> {
    return this.detailRepo.count({ where: { selected_option_id: optionId } });
  }
}
