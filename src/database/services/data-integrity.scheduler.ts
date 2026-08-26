import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SymptomSurvey } from '../../modules/symptom-survey/entities/symptom-survey.entity';
import { AssessmentDetail } from '../../modules/symptom-survey/entities/assessment-detail.entity';

@Injectable()
export class DataIntegritySchedulerService {
  private readonly logger = new Logger(DataIntegritySchedulerService.name);

  constructor(
    @InjectRepository(SymptomSurvey)
    private readonly surveyRepo: Repository<SymptomSurvey>,
    @InjectRepository(AssessmentDetail)
    private readonly detailRepo: Repository<AssessmentDetail>,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async checkAssessmentIntegrity(): Promise<void> {
    this.logger.log('🕵️ Starting weekly assessment integrity audit...');

    // Quét toàn bộ survey trong tuần
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const surveys = await this.surveyRepo.find({
      where: { evaluationDatetime: lastWeek },
    });

    for (const survey of surveys) {
      const details = await this.detailRepo.find({
        where: { assessmentId: survey.assessmentId },
      });

      const calculatedVerdict = details.every((d) => d.optionTriageLevelSnapshot === 'GREEN')
        ? 'GREEN'
        : details.some((d) => d.optionTriageLevelSnapshot === 'RED')
          ? 'RED'
          : 'YELLOW';

      if (survey.triageVerdictSnapshot !== calculatedVerdict) {
        this.logger.error(
          `❌ Integrity Check Failed for Assessment #${survey.assessmentId}: Snapshot=(${survey.triageVerdictSnapshot}) vs Calculated=(${calculatedVerdict})`,
        );
      }
    }

    this.logger.log('✅ Weekly integrity audit completed.');
  }
}
