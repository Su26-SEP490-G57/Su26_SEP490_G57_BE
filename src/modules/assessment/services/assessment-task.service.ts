import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentTask } from '../entities/assessment-task.entity';
import { setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

@Injectable()
export class AssessmentTaskService {
  private readonly logger = new Logger(AssessmentTaskService.name);

  constructor(
    @InjectRepository(AssessmentTask)
    private readonly taskRepo: Repository<AssessmentTask>,
  ) {}

  async createDailyTasksForCase(caseId: string, pod: number, date: Date = new Date()) {
    const morningOpens = setMilliseconds(setSeconds(setMinutes(setHours(date, 6), 0), 0), 0);
    const morningCloses = setMilliseconds(setSeconds(setMinutes(setHours(date, 8), 0), 0), 0);
    const afternoonOpens = setMilliseconds(setSeconds(setMinutes(setHours(date, 16), 0), 0), 0);
    const afternoonCloses = setMilliseconds(setSeconds(setMinutes(setHours(date, 18), 0), 0), 0);

    const tasks = this.taskRepo.create([
      {
        caseId,
        podContext: pod,
        scheduledSlot: 'MORNING',
        opensAt: morningOpens,
        closesAt: morningCloses,
      },
      {
        caseId,
        podContext: pod,
        scheduledSlot: 'AFTERNOON',
        opensAt: afternoonOpens,
        closesAt: afternoonCloses,
      },
    ]);

    return await this.taskRepo.save(tasks);
  }

  getScheduledSlot(date: Date): 'MORNING' | 'AFTERNOON' | null {
    const hours = date.getHours();
    if (hours >= 6 && hours < 8) return 'MORNING';
    if (hours >= 16 && hours < 18) return 'AFTERNOON';
    return null;
  }

  async findPendingTask(
    caseId: string,
    scheduledSlot: 'MORNING' | 'AFTERNOON',
    pod: number,
  ): Promise<AssessmentTask | null> {
    return await this.taskRepo.findOne({
      where: {
        caseId,
        scheduledSlot,
        podContext: pod,
        status: 'PENDING',
      },
    });
  }

  async completeTask(taskId: number, assessmentId: number) {
    return await this.taskRepo.update(taskId, {
      status: 'COMPLETED',
      assessmentId,
      completedAt: new Date(),
    });
  }

  // Reminder scheduling method every 2 hours after getting a YELLOW result
  scheduleYellowFollowUp(caseId: string) {
    this.logger.log(`[Follow-up] Scheduling YELLOW reminder for case: ${caseId}`);

    // The practical logic here would be to hook into a Job Queue (BullMQ)
    // Temporarily using setTimeout to demo your 2-hour logic
    setTimeout(
      () => {
        this.logger.log(`[Follow-up] Push notification triggered for patient ${caseId}`);
        // Call serviceNotification to send a notification to the Patient...
      },
      2 * 60 * 60 * 1000,
    );
  }
}
