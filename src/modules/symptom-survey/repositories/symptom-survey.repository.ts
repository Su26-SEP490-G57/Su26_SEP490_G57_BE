import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SymptomSurvey } from '../entities/symptom-survey.entity';

@Injectable()
export class SymptomSurveyRepository {
  constructor(
    @InjectRepository(SymptomSurvey)
    private readonly repo: Repository<SymptomSurvey>,
  ) {}

  save(survey: Partial<SymptomSurvey>): Promise<SymptomSurvey> {
    return this.repo.save(survey as SymptomSurvey);
  }

  findLatestByPatient(caseId: string): Promise<SymptomSurvey | null> {
    return this.repo.findOne({
      where: { case_id: caseId },
      order: { evaluation_datetime: 'DESC' },
    });
  }

  findById(assessmentId: number): Promise<SymptomSurvey | null> {
    return this.repo.findOne({ where: { assessment_id: assessmentId } });
  }
}
