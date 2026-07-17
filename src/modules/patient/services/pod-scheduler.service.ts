import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';

@Injectable()
export class PodSchedulerService {
  private readonly logger = new Logger(PodSchedulerService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  /**
   * Runs every 15 minutes.
   * Recalculates current_pod = floor((NOW - pod_start_date) / 24h) for all
   * non-locked patients whose ERAS has been started (pod_start_date IS NOT NULL).
   */
  @Cron('0 */15 * * * *')
  async syncPod(): Promise<void> {
    const result = await this.patientRepo
      .createQueryBuilder()
      .update(Patient)
      .set({
        currentPod: () => 'FLOOR(EXTRACT(EPOCH FROM (NOW() - pod_start_date)) / 86400)::int',
      })
      .where('is_locked = false')
      .andWhere('deleted_at IS NULL')
      .andWhere('pod_start_date IS NOT NULL')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`POD sync: ${result.affected} patient(s) updated`);
    }
  }
}
