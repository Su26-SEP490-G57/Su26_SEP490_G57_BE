import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';
import { PodProtocol } from '../entities/pod-protocol.entity';

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
   * Recalculates currentPod = floor((NOW - podStartDate) / 24h) for all
   * non-locked patients whose ERAS has been started (podStartDate IS NOT NULL).
   */
  @Cron('0 */15 * * * *')
  async syncPod(): Promise<void> {
    const protocolCountSubQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*) - 1')
      .from(PodProtocol, 'pp')
      .where('pp.operationTypeId = pc.operation_type_id')
      .getQuery();

    const result = await this.patientRepo
      .createQueryBuilder('pc')
      .update(Patient)
      .set({
        currentPod: () => `
          LEAST(
            FLOOR(EXTRACT(EPOCH FROM (NOW() - pc.pod_start_date)) / 86400)::int,
            COALESCE((${protocolCountSubQuery}), 999)
          )
        `,
      })
      .where('pc.isLocked = :isLocked', { isLocked: false })
      .andWhere('pc.podStartDate IS NOT NULL')
      .andWhere('pc.deletedAt IS NULL')
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
          'Tự động tạm dừng: Đã đạt mốc ngày POD tối đa với mức độ sức khỏe cần theo dõi kỹ (Vàng/Đỏ).',
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
