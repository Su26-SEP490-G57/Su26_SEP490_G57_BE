import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../../patient/entities/pod-protocol-tracking-log.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';
import { PodProtocol } from '../entities/pod-protocol.entity';

export interface DailyDietProgressionItem {
  caseId: string;
  previousDietLevel: number;
  newDietLevel: number;
  latestTriageColor: string | null;
  action: 'ADVANCED' | 'MAINTAINED';
  reason: string;
}

export interface DailyDietProgressionResult {
  totalProcessed: number;
  advancedCount: number;
  maintainedCount: number;
  details: DailyDietProgressionItem[];
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
  ) {}

  /**
   * Cron job runs daily at 23:59:00 (Asia/Ho_Chi_Minh) to scan the latest assessment
   * of each active patient for the day and adjust diet level accordingly.
   */
  @Cron('0 59 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleDailyCron(): Promise<void> {
    this.logger.log('Starting End-of-Day Diet Progression Scan...');
    const result = await this.processDailyDietProgression();
    this.logger.log(
      `End-of-Day Diet Progression completed: ${result.advancedCount} advanced, ${result.maintainedCount} maintained out of ${result.totalProcessed} patients`,
    );
  }

  /**
   * Process daily diet progression for all active ERAS patients.
   * Can also be called manually via API for testing/auditing.
   */
  async processDailyDietProgression(): Promise<DailyDietProgressionResult> {
    const activePatients = await this.patientRepo.find({
      where: {
        erasCompleted: false,
        isLocked: false,
      },
      relations: ['operationType'],
    });

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const result: DailyDietProgressionResult = {
      totalProcessed: 0,
      advancedCount: 0,
      maintainedCount: 0,
      details: [],
    };

    for (const patient of activePatients) {
      // Skip if patient has no active POD or hasn't started ERAS
      if (patient.currentPod === null || !patient.podStartDate) {
        continue;
      }

      result.totalProcessed++;
      const currentDietLevel = patient.currentDietLevel ?? 0;

      // 1. Find the latest assessment completed on this day (or current pod context)
      const latestSurvey = await this.surveyRepo
        .createQueryBuilder('survey')
        .where('survey.caseId = :caseId', { caseId: patient.caseId })
        .andWhere('survey.evaluationDatetime >= :startOfDay', { startOfDay })
        .andWhere('survey.evaluationDatetime <= :endOfDay', { endOfDay })
        .orderBy('survey.evaluationDatetime', 'DESC')
        .getOne();

      const surveyToEvaluate =
        latestSurvey ??
        (await this.surveyRepo
          .createQueryBuilder('survey')
          .where('survey.caseId = :caseId', { caseId: patient.caseId })
          .andWhere('survey.podContext = :currentPod', { currentPod: patient.currentPod })
          .orderBy('survey.evaluationDatetime', 'DESC')
          .getOne());

      const latestTriageColor = surveyToEvaluate?.triageColor ?? null;

      // 2. Determine max diet level for this patient's operation type
      let maxDietLevel = 4;
      if (patient.operationTypeId) {
        const count = await this.podRepo.count({
          where: { operationTypeId: patient.operationTypeId },
        });
        if (count > 0) {
          maxDietLevel = count - 1;
        }
      }

      // 3. Apply progression rules based on latest triage color
      if (latestTriageColor === 'GREEN') {
        if (currentDietLevel < maxDietLevel) {
          const newDietLevel = currentDietLevel + 1;
          patient.currentDietLevel = newDietLevel;

          // If reached Level 4 (Chế độ ăn mềm / Soft diet), record pod_soft_diet_reached
          if (newDietLevel === 4 && patient.podSoftDietReached === null) {
            patient.podSoftDietReached = patient.currentPod;
          }

          await this.patientRepo.save(patient);

          // Audit log in tracking logs
          await this.logRepo.save({
            caseId: patient.caseId,
            podNumber: patient.currentPod,
            oldStatus: `Mức ăn ${currentDietLevel}`,
            newStatus: `Mức ăn ${newDietLevel}`,
            actionType: 'System_Auto',
            holdReason: `Tự động tăng mức ăn (Mức ${currentDietLevel} -> Mức ${newDietLevel}) do đánh giá cuối ngày đạt màu XANH (GREEN - dung nạp tốt).`,
          });

          result.advancedCount++;
          result.details.push({
            caseId: patient.caseId,
            previousDietLevel: currentDietLevel,
            newDietLevel,
            latestTriageColor: 'GREEN',
            action: 'ADVANCED',
            reason: `Tự động tăng mức ăn từ Mức ${currentDietLevel} lên Mức ${newDietLevel} (Dung nạp tốt - GREEN)`,
          });
        } else {
          // Already at max level
          result.maintainedCount++;
          result.details.push({
            caseId: patient.caseId,
            previousDietLevel: currentDietLevel,
            newDietLevel: currentDietLevel,
            latestTriageColor: 'GREEN',
            action: 'MAINTAINED',
            reason: `Đã đạt mức ăn tối đa (Mức ${currentDietLevel})`,
          });
        }
      } else {
        // YELLOW, RED, or No Assessment
        const reason =
          latestTriageColor === 'YELLOW'
            ? 'Giữ nguyên mức ăn do đánh giá cuối ngày là VÀNG (YELLOW - cần theo dõi)'
            : latestTriageColor === 'RED'
              ? 'Giữ nguyên mức ăn do đánh giá cuối ngày là ĐỎ (RED - cần can thiệp)'
              : 'Giữ nguyên mức ăn do không có bài đánh giá hợp lệ trong ngày';

        await this.logRepo.save({
          caseId: patient.caseId,
          podNumber: patient.currentPod,
          oldStatus: `Mức ăn ${currentDietLevel}`,
          newStatus: `Mức ăn ${currentDietLevel}`,
          actionType: 'System_Auto',
          holdReason: reason,
        });

        result.maintainedCount++;
        result.details.push({
          caseId: patient.caseId,
          previousDietLevel: currentDietLevel,
          newDietLevel: currentDietLevel,
          latestTriageColor,
          action: 'MAINTAINED',
          reason,
        });
      }
    }

    return result;
  }
}
