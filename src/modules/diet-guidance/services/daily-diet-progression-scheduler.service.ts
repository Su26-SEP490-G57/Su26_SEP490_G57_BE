import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../../patient/entities/pod-protocol-tracking-log.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';
import { PodProtocol } from '../entities/pod-protocol.entity';
import { Alert } from '../../alert/entities/alert.entity';

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

  @Cron('1 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleDailyDietProgression(): Promise<void> {
    this.logger.log('🚀 Starting daily diet progression check...');

    const activePatients = await this.patientRepo.find({
      where: { erasCompleted: false, isLocked: false },
      relations: ['operationType'],
    });

    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date();
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    for (const patient of activePatients) {
      const lastSurvey = await this.surveyRepo
        .createQueryBuilder('survey')
        .where('survey.caseId = :caseId', { caseId: patient.caseId })
        .andWhere('survey.evaluationDatetime BETWEEN :start AND :end', {
          start: yesterdayStart,
          end: yesterdayEnd,
        })
        .orderBy('survey.evaluationDatetime', 'DESC')
        .getOne();

      if (!lastSurvey) continue;

      // New Logic: Đọc trực tiếp từ cột Snapshot ở bản ghi cha (O(1))
      const allGreen = lastSurvey.triageVerdictSnapshot === 'GREEN';

      const pendingRedAlert = await this.alertRepo.findOne({
        where: { caseId: patient.caseId, alertType: 'RED', status: 'PENDING_REVIEW' },
      });

      const currentDietLevel = patient.currentDietLevel ?? 0;
      let maxDietLevel = 4;
      const protocolCount = await this.podRepo.count({
        where: { operationTypeId: patient.operationTypeId ?? 0 },
      });
      if (protocolCount > 0) maxDietLevel = protocolCount - 1;

      if (allGreen && !pendingRedAlert) {
        if (currentDietLevel < maxDietLevel) {
          patient.currentDietLevel += 1;
          await this.patientRepo.save(patient);

          await this.logRepo.save({
            caseId: patient.caseId,
            podNumber: patient.currentPod ?? 0,
            oldStatus: `Mức ăn ${currentDietLevel}`,
            newStatus: `Mức ăn ${patient.currentDietLevel}`,
            actionType: 'System_Auto',
            holdReason:
              'Tự động tăng mức ăn: Kết quả đánh giá cuối ngày đạt GREEN (dựa trên Snapshot) và không có cảnh báo ĐỎ chờ xử lý.',
          });
          this.logger.log(
            `✅ Progressed patient ${patient.caseId} to DietLevel ${patient.currentDietLevel}`,
          );
        }
      }
    }
  }
}
