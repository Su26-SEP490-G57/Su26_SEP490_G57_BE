import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { AssessmentTask } from '../entities/assessment-task.entity';

@Injectable()
export class AssessmentTaskSchedulerService {
  private readonly logger = new Logger(AssessmentTaskSchedulerService.name);

  constructor(
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(AssessmentTask) private readonly taskRepo: Repository<AssessmentTask>,
  ) {}

  // 00:00 hàng ngày tạo task cho POD hiện tại của bệnh nhân
  @Cron('0 0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async generateDailyTasks(): Promise<void> {
    this.logger.log('Generating daily assessment tasks...');
    const patients = await this.patientRepo.find({
      where: { deletedAt: undefined, isLocked: false },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const patient of patients) {
      if (patient.currentPod === null) continue;

      // Create MORNING task (06:00 - 08:00)
      const morningOpens = new Date(today);
      morningOpens.setHours(6, 0, 0, 0);
      const morningCloses = new Date(today);
      morningCloses.setHours(8, 0, 0, 0);

      await this.taskRepo.upsert(
        {
          caseId: patient.caseId,
          podContext: patient.currentPod,
          scheduledSlot: 'MORNING',
          opensAt: morningOpens,
          closesAt: morningCloses,
        },
        ['caseId', 'podContext', 'scheduledSlot'],
      );

      // Create AFTERNOON task (16:00 - 18:00)
      const afternoonOpens = new Date(today);
      afternoonOpens.setHours(16, 0, 0, 0);
      const afternoonCloses = new Date(today);
      afternoonCloses.setHours(18, 0, 0, 0);

      await this.taskRepo.upsert(
        {
          caseId: patient.caseId,
          podContext: patient.currentPod,
          scheduledSlot: 'AFTERNOON',
          opensAt: afternoonOpens,
          closesAt: afternoonCloses,
        },
        ['caseId', 'podContext', 'scheduledSlot'],
      );
    }
  }

  // Quét mỗi giờ để đóng các task đã quá hạn
  @Cron(CronExpression.EVERY_HOUR)
  async markMissedTasks(): Promise<void> {
    const now = new Date();
    const missedTasks = await this.taskRepo.find({
      where: {
        status: 'PENDING',
        closesAt: LessThan(now),
      },
    });

    for (const task of missedTasks) {
      task.status = 'MISSED';
      task.missedAt = now;
      await this.taskRepo.save(task);
      this.logger.warn(`Task ${task.assessmentTaskId} for case ${task.caseId} marked as MISSED`);
    }
  }
}
