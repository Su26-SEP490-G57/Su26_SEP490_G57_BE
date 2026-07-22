import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';
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

  /**
   * Runs every 15 minutes.
   * Recalculates current_pod = floor((NOW - pod_start_date) / 24h) for all
   * non-locked patients whose ERAS has been started (pod_start_date IS NOT NULL).
   * POD is capped at the maximum POD defined in pod_protocols for each operation type.
   * When a patient reaches max POD, eras_completed is set to true.
   */
  @Cron('0 */15 * * * *')
  async syncPod(): Promise<void> {
    // Calculate POD based on time elapsed, but cap it at max POD from pod_protocols
    // Also mark eras_completed = true when POD reaches max
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.patientRepo.query(`
      UPDATE patient_cases pc
      SET
        current_pod = LEAST(
          FLOOR(EXTRACT(EPOCH FROM (NOW() - pc.pod_start_date)) / 86400)::int,
          COALESCE(
            (
              SELECT COUNT(*) - 1
              FROM pod_protocols pp
              WHERE pp.operation_type_id = pc.operation_type_id
            ),
            999
          )
        ),
        eras_completed = (
          FLOOR(EXTRACT(EPOCH FROM (NOW() - pc.pod_start_date)) / 86400)::int >=
          COALESCE(
            (
              SELECT COUNT(*) - 1
              FROM pod_protocols pp
              WHERE pp.operation_type_id = pc.operation_type_id
            ),
            999
          )
        )
      WHERE pc.is_locked = false
        AND pc.deleted_at IS NULL
        AND pc.pod_start_date IS NOT NULL
    `);

    const affectedRows = Array.isArray(result) && result.length > 1 ? (result[1] as number) : 0;

    if (affectedRows > 0) {
      this.logger.log(`POD sync: ${affectedRows} patient(s) updated`);
    }
  }
}
