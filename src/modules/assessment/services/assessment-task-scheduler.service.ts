import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { AssessmentTaskService } from '../services/assessment-task.service';

@Injectable()
export class AssessmentTaskSchedulerService {
  private readonly logger = new Logger(AssessmentTaskSchedulerService.name);

  constructor(
    private readonly assessmentTaskService: AssessmentTaskService,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyTaskGeneration() {
    this.logger.log('Running daily assessment task generation...');
    const activePatients = await this.patientRepo.find({
      where: { isLocked: false },
    });

    for (const patient of activePatients) {
      try {
        await this.assessmentTaskService.createDailyTasksForCase(
          patient.caseId,
          patient.currentPod ?? 0,
          new Date(),
        );
      } catch (error) {
        this.logger.error(`Failed to generate tasks for case ${patient.caseId}`, error);
      }
    }
  }
}
