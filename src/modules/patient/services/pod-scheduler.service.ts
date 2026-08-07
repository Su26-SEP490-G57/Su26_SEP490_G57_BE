/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';
//import { PodProtocol } from '../entities/pod-protocol.entity';

@Injectable()
export class PodSchedulerService {
  private readonly logger = new Logger(PodSchedulerService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    // Step 1: Update POD for all unlocked, non-completed patients
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

    if (updateResult[1] > 0) {
      this.logger.log(`[Step 1] POD updated for ${updateResult[1]} patient(s)`);
    }

    // Step 2: Mark GREEN patients as completed when reaching max POD
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
        AND pc.is_locked = false
        AND pc.deleted_at IS NULL
    `);

    if (completedResult[1] > 0) {
      this.logger.log(`[Step 2] ${completedResult[1]} GREEN patient(s) marked as ERAS completed`);
    }

    // Step 3: Auto-lock YELLOW/RED patients at max POD
    const lockedResult = await this.patientRepo.query(`
      UPDATE patient_cases pc
      SET
        is_locked = true,
        locked_at = NOW(),
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
        AND pc.eras_completed = false
        AND pc.deleted_at IS NULL
    `);

    if (lockedResult[1] > 0) {
      this.logger.log(`[Step 3] ${lockedResult[1]} YELLOW/RED patient(s) auto-locked at max POD`);
    }
  }
}
