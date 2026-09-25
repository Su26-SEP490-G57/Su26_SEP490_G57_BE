import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
  private readonly logger = new Logger(SymptomSurveyRepository.name);
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
    return this.optionRepo.find({
      where: { optionId: In(ids) },
      relations: ['question'],
    });
  }

  findLatestByPatient(caseId: string): Promise<SymptomSurvey | null> {
    return this.surveyRepo.findOne({
      where: { caseId: caseId },
      order: { evaluationDatetime: 'DESC' },
    });
  }

  findAllByPatient(
    caseId: string,
    page: number,
    limit: number,
  ): Promise<[SymptomSurvey[], number]> {
    return this.surveyRepo.findAndCount({
      where: { caseId: caseId },
      order: { evaluationDatetime: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findCurrentPod(caseId: string): Promise<number | null> {
    const patient = await this.patientRepo.findOne({
      where: { caseId: caseId },
      select: ['currentPod'],
    });
    return patient?.currentPod ?? null;
  }

  async isErasCompleted(caseId: string): Promise<boolean> {
    const patient = await this.patientRepo.findOne({
      where: { caseId: caseId },
      select: ['erasCompleted'],
    });
    if (!patient) return false;
    return Boolean(patient.erasCompleted);
  }

  async syncPatientLevel(caseId: string, triageColor: string): Promise<void> {
    this.logger.log('Starting patient level sync', { caseId, triageColor });

    const levelName = TRIAGE_TO_LEVEL_NAME[triageColor];

    if (!levelName) {
      this.logger.error('No levelName mapping found', { caseId, triageColor });
      return;
    }

    const level = await this.levelRepo.findOne({
      where: { levelName: levelName as 'Red' | 'Yellow' | 'Green' },
    });

    if (!level) {
      this.logger.error('Level not found in database', { caseId, levelName });
      return;
    }

    // Diet progression is locked for as long as the LATEST assessment/reassessment
    // says the patient is Yellow/Red — regardless of whether any Alert tied to it
    // has since been HANDLED. Only a new assessment/reassessment that lands back
    // on Green lifts it (see the "Auto-locked:" prefix convention the mobile app
    // already special-cases in LockedPodBanner for a friendlier message).
    const isNonGreen = levelName !== 'Green';
    const levelNameVi = levelName === 'Red' ? 'Đỏ' : 'Vàng';
    const lockFields = isNonGreen
      ? {
          isLocked: true,
          reasonHoldPod: `Auto-locked: Đang ở mức ${levelNameVi} — mức ăn sẽ tự mở lại khi có đánh giá mới (hoặc đánh giá lại) cho kết quả Xanh`,
        }
      : { isLocked: false, reasonHoldPod: null };

    this.logger.log('Updating patient level', {
      caseId,
      levelId: level.levelId,
      levelName,
      ...lockFields,
    });
    const result = await this.patientRepo.update(
      { caseId: caseId },
      { levelId: level.levelId, ...lockFields },
    );

    if (result.affected === 0) {
      this.logger.warn('No rows updated - patient may not exist', { caseId });
    } else {
      this.logger.log('Patient level synced successfully', { caseId, affected: result.affected });
    }
  }

  async lockPatientCase(caseId: string, reason: string): Promise<void> {
    await this.patientRepo.update(
      { caseId },
      { isLocked: true, lockedAt: new Date(), reasonHoldPod: reason },
    );
  }

  findById(assessmentId: number): Promise<SymptomSurvey | null> {
    return this.surveyRepo.findOne({ where: { assessmentId: assessmentId } });
  }

  findDetailsById(assessmentId: number): Promise<AssessmentDetail[]> {
    return this.detailRepo.find({
      where: { assessmentId: assessmentId },
      relations: ['question', 'selectedOption'],
    });
  }

  findAllQuestions(): Promise<SurveyQuestion[]> {
    return this.questionRepo.find({ order: { orderNumber: 'ASC' } });
  }

  findQuestionById(questionId: number): Promise<SurveyQuestion | null> {
    return this.questionRepo.findOne({ where: { questionId: questionId } });
  }

  saveQuestion(data: Partial<SurveyQuestion>): Promise<SurveyQuestion> {
    return this.questionRepo.save(data as SurveyQuestion);
  }

  async deleteQuestion(questionId: number): Promise<void> {
    await this.questionRepo.delete({ questionId: questionId });
  }

  countDetailsByQuestion(questionId: number): Promise<number> {
    return this.detailRepo.count({ where: { questionId: questionId } });
  }

  findOptionById(optionId: number): Promise<QuestionOption | null> {
    return this.optionRepo.findOne({ where: { optionId: optionId } });
  }

  saveOption(data: Partial<QuestionOption>): Promise<QuestionOption> {
    return this.optionRepo.save(data as QuestionOption);
  }

  saveOptions(data: Partial<QuestionOption>[]): Promise<QuestionOption[]> {
    return this.optionRepo.save(data as QuestionOption[]);
  }

  async deleteOption(optionId: number): Promise<void> {
    await this.optionRepo.delete({ optionId: optionId });
  }

  countDetailsByOption(optionId: number): Promise<number> {
    return this.detailRepo.count({ where: { selectedOptionId: optionId } });
  }

  findPatientByCaseId(caseId: string): Promise<Patient | null> {
    return this.patientRepo.findOne({ where: { caseId: caseId } });
  }

  async countVomitingInPod(caseId: string, podContext: number): Promise<number> {
    const result = await this.detailRepo
      .createQueryBuilder('detail')
      .innerJoin('detail.assessment', 'assessment')
      .where('assessment.caseId = :caseId', { caseId })
      .andWhere('assessment.podContext = :podContext', { podContext })
      .andWhere('detail.clinicalDimensionSnapshot = :dimension', { dimension: 'VOMITING' })
      .andWhere('detail.normalizedValueSnapshot > 0')
      .select('SUM(detail.normalizedValueSnapshot)', 'count')
      .getRawOne<{ count: string | null }>();

    return parseInt(result?.count || '0', 10);
  }

  countQuestions(): Promise<number> {
    return this.questionRepo.count();
  }
}
