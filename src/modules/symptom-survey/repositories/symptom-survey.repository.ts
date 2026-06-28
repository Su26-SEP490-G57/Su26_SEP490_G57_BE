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

  async findCurrentPod(caseId: string): Promise<number | null> {
    const patient = await this.patientRepo.findOne({ where: { case_id: caseId }, select: ['current_pod'] });
    return patient?.current_pod ?? null;
  }

  async syncPatientLevel(caseId: string, triageColor: 'GREEN' | 'YELLOW' | 'RED'): Promise<void> {
    const levelName = TRIAGE_TO_LEVEL_NAME[triageColor];
    const level = await this.levelRepo.findOne({ where: { level_name: levelName as Level['level_name'] } });
    if (!level) return;
    await this.patientRepo.update({ case_id: caseId }, { level_id: level.level_id });
  }
}
