import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Alert } from '../../alert/entities/alert.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../../patient/entities/pod-protocol-tracking-log.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';
import { PodProtocol } from '../entities/pod-protocol.entity';

export type DailyDietProgressionAction = 'ADVANCED' | 'MAINTAINED';

export interface DailyDietProgressionDetail {
  caseId: string;
  previousDietLevel: number;
  newDietLevel: number;
  latestTriageColor: 'GREEN' | 'YELLOW' | 'RED' | null;
  action: DailyDietProgressionAction;
  reason: string;
}

export interface DailyDietProgressionResult {
  totalProcessed: number;
  advancedCount: number;
  maintainedCount: number;
  details: DailyDietProgressionDetail[];
}

@Injectable()
export class DailyDietProgressionSchedulerService {
  private readonly logger = new Logger(DailyDietProgressionSchedulerService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(SymptomSurvey)
    private readonly surveyRepo: Repository<SymptomSurvey>,
    @InjectRepository(PodProtocolTrackingLog)
    private readonly logRepo: Repository<PodProtocolTrackingLog>,
    @InjectRepository(PodProtocol)
    private readonly podRepo: Repository<PodProtocol>,
    private readonly dataSource: DataSource,
  ) {}

  private get alertRepo() {
    return this.dataSource.getRepository(Alert);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePodProgression(): Promise<void> {
    this.logger.log('🚀 Checking for POD progression...');
    const patients = await this.patientRepo.find({
      where: { erasCompleted: false, isLocked: false },
    });

    const now = new Date();
    for (const patient of patients) {
      if (patient.podStartDate) {
        const elapsedHours =
          (now.getTime() - new Date(patient.podStartDate).getTime()) / (1000 * 60 * 60);
        const expectedPod = Math.floor(elapsedHours / 24);

        if (patient.currentPod !== null && expectedPod > patient.currentPod) {
          patient.currentPod = expectedPod;
          await this.patientRepo.save(patient);
          this.logger.log(`✅ POD updated for case ${patient.caseId} to ${expectedPod}`);
        }
      }
    }
  }

  /** Cron adapter. Clinical progression is implemented by processDailyDietProgression(). */
  @Cron('1 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleDailyDietProgression(): Promise<void> {
    const result = await this.processDailyDietProgression();
    this.logger.log(
      `Daily Diet Level scan completed: ${result.advancedCount} advanced, ${result.maintainedCount} maintained.`,
    );
  }

  /**
   * Applies one auditable Diet Level decision per eligible patient. This method is
   * intentionally independent of Cron and HTTP so manual runs and scheduled runs
   * use the identical clinical workflow.
   */
  async processDailyDietProgression(now = new Date()): Promise<DailyDietProgressionResult> {
    const activePatients = await this.patientRepo.find({
      where: { erasCompleted: false, isLocked: false },
    });
    const { start, end } = this.getHoChiMinhDayBounds(now);
    const details: DailyDietProgressionDetail[] = [];

    for (const patient of activePatients) {
      // A patient without an active POD has not entered the ERAS workflow.
      if (patient.currentPod === null || !patient.podStartDate) continue;

      const previousDietLevel = patient.currentDietLevel ?? 0;
      const survey = await this.findLatestEligibleSurvey(
        patient.caseId,
        patient.currentPod,
        start,
        end,
      );
      const latestTriageColor = this.normalizeTriageColor(
        survey?.triageVerdictSnapshot ?? survey?.triageColor ?? null,
      );
      const pendingRedAlert = await this.alertRepo.findOne({
        where: { caseId: patient.caseId, alertType: 'RED', status: 'PENDING_REVIEW' },
      });
      const maxDietLevel = await this.getMaxDietLevel(patient.operationTypeId);

      const decision = this.resolveDecision({
        caseId: patient.caseId,
        previousDietLevel,
        latestTriageColor,
        hasPendingRedAlert: pendingRedAlert !== null,
        maxDietLevel,
      });

      await this.persistDecision(patient, decision);
      details.push(decision);
    }

    return {
      totalProcessed: details.length,
      advancedCount: details.filter((detail) => detail.action === 'ADVANCED').length,
      maintainedCount: details.filter((detail) => detail.action === 'MAINTAINED').length,
      details,
    };
  }

  private async findLatestEligibleSurvey(
    caseId: string,
    currentPod: number,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<SymptomSurvey | null> {
    const todaySurvey = await this.surveyRepo
      .createQueryBuilder('survey')
      .where('survey.caseId = :caseId', { caseId })
      .andWhere('survey.evaluationDatetime BETWEEN :dayStart AND :dayEnd', { dayStart, dayEnd })
      .orderBy('survey.evaluationDatetime', 'DESC')
      .getOne();
    if (todaySurvey) return todaySurvey;

    return this.surveyRepo
      .createQueryBuilder('survey')
      .where('survey.caseId = :caseId', { caseId })
      .andWhere('survey.podContext = :currentPod', { currentPod })
      .orderBy('survey.evaluationDatetime', 'DESC')
      .getOne();
  }

  private async getMaxDietLevel(operationTypeId: number | null): Promise<number> {
    if (operationTypeId === null) return 4;

    const protocolCount = await this.podRepo.count({ where: { operationTypeId } });
    return protocolCount > 0 ? protocolCount - 1 : 4;
  }

  private resolveDecision(input: {
    caseId: string;
    previousDietLevel: number;
    latestTriageColor: DailyDietProgressionDetail['latestTriageColor'];
    hasPendingRedAlert: boolean;
    maxDietLevel: number;
  }): DailyDietProgressionDetail {
    const { caseId, previousDietLevel, latestTriageColor, hasPendingRedAlert, maxDietLevel } =
      input;

    if (!latestTriageColor) {
      return this.maintained(
        caseId,
        previousDietLevel,
        null,
        'Không tìm thấy đánh giá hợp lệ cho bệnh nhân.',
      );
    }
    if (hasPendingRedAlert) {
      return this.maintained(
        caseId,
        previousDietLevel,
        latestTriageColor,
        'Fail-safe: còn cảnh báo ĐỎ chờ xử trí, không tự động tăng mức ăn.',
      );
    }
    if (latestTriageColor === 'RED') {
      return this.maintained(
        caseId,
        previousDietLevel,
        latestTriageColor,
        'Đánh giá gần nhất là ĐỎ.',
      );
    }
    if (latestTriageColor === 'YELLOW') {
      return this.maintained(
        caseId,
        previousDietLevel,
        latestTriageColor,
        'Đánh giá gần nhất là VÀNG.',
      );
    }
    if (previousDietLevel >= maxDietLevel) {
      return this.maintained(
        caseId,
        previousDietLevel,
        latestTriageColor,
        'Bệnh nhân đã đạt mức ăn tối đa của phác đồ.',
      );
    }

    return {
      caseId,
      previousDietLevel,
      newDietLevel: previousDietLevel + 1,
      latestTriageColor,
      action: 'ADVANCED',
      reason: 'Tự động tăng mức ăn: đánh giá gần nhất là XANH và không có cảnh báo ĐỎ chờ xử trí.',
    };
  }

  private maintained(
    caseId: string,
    dietLevel: number,
    latestTriageColor: DailyDietProgressionDetail['latestTriageColor'],
    reason: string,
  ): DailyDietProgressionDetail {
    return {
      caseId,
      previousDietLevel: dietLevel,
      newDietLevel: dietLevel,
      latestTriageColor,
      action: 'MAINTAINED',
      reason,
    };
  }

  private async persistDecision(
    patient: Patient,
    decision: DailyDietProgressionDetail,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (decision.action === 'ADVANCED') {
        patient.currentDietLevel = decision.newDietLevel;
        if (decision.newDietLevel === 4 && patient.podSoftDietReached === null) {
          patient.podSoftDietReached = patient.currentPod;
        }
        await manager.save(patient);
      }

      await manager.save(
        manager.create(PodProtocolTrackingLog, {
          caseId: patient.caseId,
          podNumber: patient.currentPod,
          oldStatus: `Mức ăn ${decision.previousDietLevel}`,
          newStatus: `Mức ăn ${decision.newDietLevel}`,
          actionType: 'System_Auto',
          changedById: null,
          holdReason: decision.reason,
        }),
      );
    });
  }

  private normalizeTriageColor(
    value: string | null,
  ): DailyDietProgressionDetail['latestTriageColor'] {
    // Only accept the canonical clinical values written by SymptomSurveyService.
    // Legacy seed/import values such as "Green" are not valid snapshots and must
    // fail safe rather than causing automatic Diet Level progression.
    return value === 'GREEN' || value === 'YELLOW' || value === 'RED' ? value : null;
  }

  /** Returns UTC instants bounding the current calendar day in Asia/Ho_Chi_Minh (UTC+7). */
  private getHoChiMinhDayBounds(now: Date): { start: Date; end: Date } {
    const hoChiMinhTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const start = new Date(
      Date.UTC(
        hoChiMinhTime.getUTCFullYear(),
        hoChiMinhTime.getUTCMonth(),
        hoChiMinhTime.getUTCDate(),
        -7,
      ),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }
}
