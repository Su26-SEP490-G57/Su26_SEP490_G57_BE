import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentTask } from '../entities/assessment-task.entity';

@Injectable()
export class AssessmentTaskRepository {
  constructor(
    @InjectRepository(AssessmentTask)
    private readonly repo: Repository<AssessmentTask>,
  ) {}

  async findPendingTask(
    caseId: string,
    slot: 'MORNING' | 'AFTERNOON',
    pod: number,
  ): Promise<AssessmentTask | null> {
    return this.repo.findOne({
      where: {
        caseId,
        podContext: pod,
        scheduledSlot: slot,
        status: 'PENDING',
      },
    });
  }

  async create(task: Partial<AssessmentTask>): Promise<AssessmentTask> {
    return this.repo.save(this.repo.create(task));
  }

  async markCompleted(taskId: number, assessmentId: number): Promise<void> {
    await this.repo.update(taskId, {
      status: 'COMPLETED',
      assessmentId,
      completedAt: new Date(),
    });
  }

  async markMissed(taskId: number): Promise<void> {
    await this.repo.update(taskId, {
      status: 'MISSED',
      missedAt: new Date(),
    });
  }

  async findActiveTasks(): Promise<AssessmentTask[]> {
    return this.repo.find({ where: { status: 'PENDING' } });
  }
}
