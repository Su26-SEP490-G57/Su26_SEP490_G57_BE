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

  async findOpenPendingTask(
    caseId: string,
    pod: number,
    now: Date,
  ): Promise<AssessmentTask | null> {
    return this.repo
      .createQueryBuilder('task')
      .where('task.case_id = :caseId', { caseId })
      .andWhere('task.pod_context = :pod', { pod })
      .andWhere('task.status = :status', { status: 'PENDING' })
      .andWhere('task.opens_at <= :now', { now })
      .andWhere('task.closes_at >= :now', { now })
      .orderBy('task.opens_at', 'ASC')
      .getOne();
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
