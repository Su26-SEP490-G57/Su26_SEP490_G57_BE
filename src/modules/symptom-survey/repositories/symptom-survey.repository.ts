import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentDetail } from '../entities/assessment-detail.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { SurveyQuestion } from '../entities/survey-question.entity';
import { SymptomSurvey } from '../entities/symptom-survey.entity';

@Injectable()
export class SymptomSurveyRepository {
  constructor(
    @InjectRepository(SymptomSurvey)
    private readonly surveyRepo: Repository<SymptomSurvey>,
    @InjectRepository(AssessmentDetail)
    private readonly detailRepo: Repository<AssessmentDetail>,
    @InjectRepository(SurveyQuestion)
    private readonly questionRepo: Repository<SurveyQuestion>,
    @InjectRepository(QuestionOption)
    private readonly optionRepo: Repository<QuestionOption>,
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
}
