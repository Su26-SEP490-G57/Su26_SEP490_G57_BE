import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Job } from 'bull';
import { Patient } from '../../patient/entities/patient.entity';
import { Alert } from '../../alert/entities/alert.entity';

@Processor('auto-complete')
export class AutoCompleteProcessor {
  private readonly logger = new Logger(AutoCompleteProcessor.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly dataSource: DataSource,
  ) {}

  @Process('check-completion')
  async handleCompletion(job: Job<{ caseId: string; reachedAt: string }>) {
    const { caseId } = job.data;

    this.logger.log('Processing auto-complete check', { caseId });

    const patient = await this.patientRepo.findOne({
      where: { caseId },
      relations: ['level'],
    });

    if (!patient) {
      this.logger.warn('Patient not found', { caseId });
      return { skipped: true, reason: 'Patient not found' };
    }

    if (patient.erasCompleted || patient.isLocked) {
      return { skipped: true, reason: 'Already completed or locked' };
    }

    // Verify still at maxDietLevel
    const maxDietLevel = await this.getMaxDietLevel(patient.operationTypeId);
    if (patient.currentDietLevel !== maxDietLevel) {
      this.logger.log('Diet level changed, skipping auto-complete', {
        caseId,
        current: patient.currentDietLevel,
        max: maxDietLevel,
      });
      return { skipped: true, reason: 'Diet level changed' };
    }

    // Verify GREEN + no pending RED alert
    if (patient.level?.levelName !== 'Green') {
      this.logger.log('Patient not GREEN, skipping auto-complete', {
        caseId,
        level: patient.level?.levelName,
      });
      return { skipped: true, reason: 'Not GREEN' };
    }

    const alertRepo = this.dataSource.getRepository(Alert);
    const pendingRedAlert = await alertRepo.findOne({
      where: { caseId, alertType: 'RED', status: 'PENDING_REVIEW' },
    });

    if (pendingRedAlert) {
      this.logger.log('Pending RED alert exists, skipping auto-complete', {
        caseId,
        alertId: pendingRedAlert.alertId,
      });
      return { skipped: true, reason: 'Pending RED alert' };
    }

    // Complete patient
    await this.patientRepo.update(
      { caseId },
      {
        erasCompleted: true,
        isLocked: true,
      },
    );

    this.logger.log('Patient auto-completed', { caseId });
    return { completed: true };
  }

  private async getMaxDietLevel(operationTypeId: number | null): Promise<number> {
    if (!operationTypeId) return 4;

    // Query max diet level from pod_protocols table
    const result = await this.dataSource.query<{ max_level: number }[]>(
      `
      SELECT MAX(diet_level) as max_level
      FROM pod_protocols
      WHERE operation_type_id = $1
    `,
      [operationTypeId],
    );

    return result[0]?.max_level ?? 4;
  }
}
