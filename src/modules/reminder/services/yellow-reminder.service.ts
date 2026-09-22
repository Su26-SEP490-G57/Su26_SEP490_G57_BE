import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class YellowReminderService {
  private readonly logger = new Logger(YellowReminderService.name);

  constructor(@InjectQueue('yellow-reminder') private queue: Queue) {}

  /**
   * Schedule a YELLOW reminder to fire 2 hours after alert creation
   */
  async scheduleReminder(caseId: string, alertId: number): Promise<void> {
    const jobId = `yellow-reminder-${alertId}`;

    await this.queue.add(
      'send-reminder',
      { caseId, alertId },
      {
        delay: 2 * 60 * 60 * 1000, // 2 hours
        jobId,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      },
    );

    this.logger.log('Scheduled YELLOW reminder', { caseId, alertId });
  }

  /**
   * Cancel a scheduled reminder when alert is HANDLED before 2 hours
   */
  async cancelReminder(alertId: number): Promise<void> {
    const jobId = `yellow-reminder-${alertId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log('Cancelled YELLOW reminder', { alertId });
    }
  }
}
