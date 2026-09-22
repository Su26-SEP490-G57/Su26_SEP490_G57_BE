import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Alert } from '../../alert/entities/alert.entity';
import { NotificationService } from '../../alert/services/notification.service';

@Processor('yellow-reminder')
export class YellowReminderProcessor {
  private readonly logger = new Logger(YellowReminderProcessor.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('send-reminder')
  async handleReminder(job: Job<{ caseId: string; alertId: number }>) {
    const { caseId, alertId } = job.data;

    this.logger.log('Processing YELLOW reminder', { caseId, alertId });

    // Verify alert still YELLOW + PENDING
    const alert = await this.alertRepo.findOne({ where: { alertId } });

    if (!alert) {
      this.logger.warn('Alert not found, skipping reminder', { alertId });
      return { skipped: true, reason: 'Alert not found' };
    }

    if (alert.status === 'HANDLED') {
      this.logger.log('Alert already handled, skipping reminder', { alertId });
      return { skipped: true, reason: 'Alert already handled' };
    }

    if (alert.alertType !== 'YELLOW') {
      this.logger.warn('Alert type changed, skipping reminder', {
        alertId,
        alertType: alert.alertType,
      });
      return { skipped: true, reason: 'Alert type changed' };
    }

    // Send FCM reminder to patient
    const result = await this.notificationService.sendToPatientCase(
      caseId,
      'Nhắc nhở đánh giá lại',
      'Vui lòng cập nhật tình trạng sức khỏe sau 2 giờ.',
      { assessmentType: 'TRIGGERED', alertId: alertId.toString() },
    );

    this.logger.log('YELLOW reminder sent', {
      caseId,
      alertId,
      attempted: result.attempted,
      sent: result.sent,
    });

    return { sent: true, attempted: result.attempted, delivered: result.sent };
  }
}
