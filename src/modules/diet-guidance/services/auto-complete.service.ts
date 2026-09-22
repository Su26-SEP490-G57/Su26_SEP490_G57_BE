import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class AutoCompleteService {
  private readonly logger = new Logger(AutoCompleteService.name);

  constructor(@InjectQueue('auto-complete') private queue: Queue) {}

  /**
   * Schedule auto-completion 24 hours after patient reaches maxDietLevel
   */
  async scheduleCompletion(caseId: string, reachedAt: Date): Promise<void> {
    const jobId = `auto-complete-${caseId}`;
    const delay = 24 * 60 * 60 * 1000; // 24 hours

    await this.queue.add(
      'check-completion',
      { caseId, reachedAt: reachedAt.toISOString() },
      {
        delay,
        jobId,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      },
    );

    this.logger.log('Scheduled auto-complete', {
      caseId,
      reachedAt: reachedAt.toISOString(),
      executeAt: new Date(reachedAt.getTime() + delay).toISOString(),
    });
  }

  /**
   * Cancel scheduled completion when patient's diet level is decreased below max
   */
  async cancelCompletion(caseId: string): Promise<void> {
    const jobId = `auto-complete-${caseId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log('Cancelled auto-complete', { caseId });
    }
  }
}
