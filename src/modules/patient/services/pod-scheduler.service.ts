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
   * POD is capped at the maximum POD defined in pod_protocols for each operation type.
   * When a patient reaches max POD, erasCompleted is set to true.
   */
  @Cron('0 */15 * * * *')
  async syncPod(): Promise<void> {
    const protocolCountSubQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*) - 1')
      .from(PodProtocol, 'pp')
      .where('pp.operationTypeId = pc.operation_type_id')
      .getQuery();

    const floorExpr = 'FLOOR(EXTRACT(EPOCH FROM (NOW() - pc.pod_start_date)) / 86400)::int';
    const maxPodExpr = `COALESCE((${protocolCountSubQuery}), 999)`;

    const result = await this.patientRepo
      .createQueryBuilder('pc')
      .update(Patient)
      .set({
        currentPod: () => `LEAST(${floorExpr}, ${maxPodExpr})`,
        erasCompleted: () => `(${floorExpr}) >= (${maxPodExpr})`,
      })
      .where('pc.isLocked = :isLocked', { isLocked: false })
      .andWhere('pc.podStartDate IS NOT NULL')
      .andWhere('pc.deletedAt IS NULL')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`POD sync: ${result.affected} patient(s) updated`);
    }
  }
}
