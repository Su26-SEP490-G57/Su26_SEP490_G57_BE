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
   *
   * New logic:
   * - When patient reaches max POD with GREEN level → set eras_completed = true
   * - When patient reaches max POD with YELLOW/RED level → auto-lock POD (is_locked = true)
   */
  @Cron('0 */15 * * * *')
  async syncPod(): Promise<void> {
    // Step 1: Update POD for all unlocked, active patients
    // Cap POD at max level from pod_protocols
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updateResult = await this.patientRepo.query(`
      UPDATE patient_cases pc
      SET current_pod = LEAST(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - pc.pod_start_date)) / 86400)::int,
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
        AND pc.eras_completed = false
    `);

    const updatedRows =
      Array.isArray(updateResult) && updateResult.length > 1 ? (updateResult[1] as number) : 0;

    if (updatedRows > 0) {
      this.logger.log(`POD sync: ${updatedRows} patient(s) updated`);
    }

    // Step 2: Mark GREEN patients as completed when they reach max POD
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const completedResult = await this.patientRepo.query(`
      UPDATE patient_cases pc
      SET eras_completed = true
      FROM levels l
      WHERE pc.level_id = l.level_id
        AND l.level_name = 'Green'
        AND pc.eras_completed = false
        AND pc.current_pod >= COALESCE(
          (
            SELECT COUNT(*) - 1
            FROM pod_protocols pp
            WHERE pp.operation_type_id = pc.operation_type_id
          ),
          999
        )
        AND pc.pod_start_date IS NOT NULL
        AND pc.deleted_at IS NULL
    `);

    const completedRows =
      Array.isArray(completedResult) && completedResult.length > 1
        ? (completedResult[1] as number)
        : 0;

    if (completedRows > 0) {
      this.logger.log(`ERAS completed: ${completedRows} GREEN patient(s) marked as completed`);
    }

    // Step 3: Auto-lock YELLOW/RED patients when they reach max POD
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const lockResult = await this.patientRepo.query(`
      UPDATE patient_cases pc
      SET
        is_locked = true,
        reason_hold_pod = 'Auto-locked: Reached max POD with concerning health status (Yellow/Red level)'
      FROM levels l
      WHERE pc.level_id = l.level_id
        AND l.level_name IN ('Yellow', 'Red')
        AND pc.is_locked = false
        AND pc.current_pod >= COALESCE(
          (
            SELECT COUNT(*) - 1
            FROM pod_protocols pp
            WHERE pp.operation_type_id = pc.operation_type_id
          ),
          999
        )
        AND pc.pod_start_date IS NOT NULL
        AND pc.deleted_at IS NULL
    `);

    const lockedRows =
      Array.isArray(lockResult) && lockResult.length > 1 ? (lockResult[1] as number) : 0;

    if (lockedRows > 0) {
      this.logger.log(`Auto-locked: ${lockedRows} YELLOW/RED patient(s) locked at max POD`);
    }
  }
}
