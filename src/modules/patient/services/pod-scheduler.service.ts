import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class PodSchedulerService {
  private readonly logger = new Logger(PodSchedulerService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async incrementPod(): Promise<void> {
    const result = await this.patientRepo
      .createQueryBuilder()
      .update(Patient)
      .set({ current_pod: () => 'current_pod + 1' })
      .where('is_locked = false')
      .andWhere('deleted_at IS NULL')
      .andWhere('current_pod IS NOT NULL')
      .execute();

    this.logger.log(`POD auto-increment: ${result.affected ?? 0} patients advanced`);
  }
}
