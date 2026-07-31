import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';

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
    // The `pod_protocols` count is a correlated subquery referencing the row being
    // updated by its table name — UPDATE statements built via QueryBuilder have no
    // alias for the target table, so `patient_cases` itself is the only handle available.
    const maxPodExpression = `COALESCE(
      (SELECT COUNT(*) - 1 FROM pod_protocols pp WHERE pp.operation_type_id = patient_cases.operation_type_id),
      999
    )`;

    // Step 1: Update POD for all unlocked, non-completed patients
    const updateResult = await this.patientRepo
      .createQueryBuilder()
      .update(Patient)
      .set({
        currentPod: () => `LEAST(
          FLOOR(EXTRACT(EPOCH FROM (NOW() - pod_start_date)) / 86400)::int,
          ${maxPodExpression}
        )`,
      })
      .where('is_locked = false')
      .andWhere('deleted_at IS NULL')
      .andWhere('pod_start_date IS NOT NULL')
      .andWhere('eras_completed = false')
      .execute();

    if ((updateResult.affected ?? 0) > 0) {
      this.logger.log(`[Step 1] POD updated for ${updateResult.affected} patient(s)`);
    }

    // Step 2: Mark GREEN patients as completed when reaching max POD
    const completedResult = await this.patientRepo
      .createQueryBuilder()
      .update(Patient)
      .set({ erasCompleted: true })
      .where('level_id = (SELECT level_id FROM levels WHERE level_name = :green)', {
        green: 'Green',
      })
      .andWhere('eras_completed = false')
      .andWhere(`current_pod >= ${maxPodExpression}`)
      .andWhere('pod_start_date IS NOT NULL')
      .andWhere('is_locked = false')
      .andWhere('deleted_at IS NULL')
      .execute();

    if ((completedResult.affected ?? 0) > 0) {
      this.logger.log(
        `[Step 2] ${completedResult.affected} GREEN patient(s) marked as ERAS completed`,
      );
    }

    // Step 3: Auto-lock YELLOW/RED patients at max POD
    const lockedResult = await this.patientRepo
      .createQueryBuilder()
      .update(Patient)
      .set({
        isLocked: true,
        lockedAt: () => 'NOW()',
        reasonHoldPod:
          'Auto-locked: Reached max POD with concerning health status (Yellow/Red level)',
      })
      .where('level_id IN (SELECT level_id FROM levels WHERE level_name IN (:...colors))', {
        colors: ['Yellow', 'Red'],
      })
      .andWhere('is_locked = false')
      .andWhere(`current_pod >= ${maxPodExpression}`)
      .andWhere('pod_start_date IS NOT NULL')
      .andWhere('eras_completed = false')
      .andWhere('deleted_at IS NULL')
      .execute();

    if ((lockedResult.affected ?? 0) > 0) {
      this.logger.log(
        `[Step 3] ${lockedResult.affected} YELLOW/RED patient(s) auto-locked at max POD`,
      );
    }
  }
}
