import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserResponseDto } from '../../user/dtos/user-response.dto';

const RED_ASSESSMENT_LOCK_MINUTES = 60;
import { AlertResponseDto, PaginatedAlertsDto } from '../dtos/alert-response.dto';
import { CreateAlertDto } from '../dtos/create-alert.dto';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { Alert } from '../entities/alert.entity';
import { AlertRepository } from '../repositories/alert.repository';
import { NotificationService } from './notification.service';
import { PatientRepository } from 'src/modules/patient/repositories/patient.repository';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';

import { AlertGateway } from '../gateways/alert.gateway';

@Injectable()
export class AlertService {
  constructor(
    private readonly repository: AlertRepository,
    private readonly alertGateway: AlertGateway,
    private readonly notificationService: NotificationService,
    private readonly patientRepository: PatientRepository,
    private readonly roomNurseRepository: RoomNurseAssignmentRepository,
  ) {}

  private toResponse(alert: Alert): AlertResponseDto {
    return {
      alertId: alert.alertId,
      caseId: alert.caseId,
      assessmentId: alert.assessmentId,
      surveyScore: alert.surveyScore,
      alertType: alert.alertType,
      status: alert.status,
      isAutoProgression: alert.isAutoProgression,
      triggeredAt: alert.triggeredAt,
      nurseAction: alert.nurseAction,
      nursingNote: alert.nursingNote,
      handledAt: alert.handledAt,
      handledByUserId: alert.handledByUserId,
      closedAt: alert.closedAt,
    };
  }

  async createAlert(dto: CreateAlertDto): Promise<AlertResponseDto> {
    const saved = await this.repository.save({
      caseId: dto.caseId,
      assessmentId: dto.assessmentId,
      surveyScore: dto.surveyScore,
      alertType: dto.alertType,
      status: 'PENDING_REVIEW',
      isAutoProgression: true,
      triggeredAt: new Date(),
    });

    const response = this.toResponse(saved);

    // Emit real-time alert to dashboard
    this.alertGateway.emitNewAlert(response);

    const patient = await this.patientRepository.findByIdWithRelations(saved.caseId);
    const patientName = patient?.account?.fullName ?? saved.caseId;
    const room = patient?.roomBed ?? '';
    const roomCode = room.split('/')[0].trim().toUpperCase();

    // Nurse notifications are intentionally RED-only and limited to nurses assigned
    // to the normalized patient room. Yellow alerts remain available for dashboard monitoring.
    if (saved.alertType === 'RED') {
      const pushTitle = '🔴 Cảnh báo khẩn';
      const pushBody = `${patientName} • ${room} • Mức đỏ`;
      const assignedNurseIds = await this.roomNurseRepository.getAssignedNurses(roomCode);

      if (assignedNurseIds.length > 0) {
        await this.notificationService.sendToNursesSpecific(assignedNurseIds, pushTitle, pushBody, {
          caseId: saved.caseId,
          assessmentId: String(saved.assessmentId),
          patientName,
          roomBed: room,
          alertType: saved.alertType,
        });
      }
    }

    return response;
  }

  async getAlerts(query: QueryAlertDto): Promise<PaginatedAlertsDto> {
    const [alerts, total] = await this.repository.findAll(query);
    return {
      data: alerts.map((a) => this.toResponse(a)),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };
  }

  async handleAlert(alertId: number, caller: UserResponseDto): Promise<AlertResponseDto> {
    const alert = await this.repository.findById(alertId);
    if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

    if (alert.status === 'HANDLED') {
      return this.toResponse(alert);
    }

    if (alert.alertType !== 'RED' || alert.status !== 'PENDING_REVIEW') {
      throw new ForbiddenException('Only pending RED alerts can be handled by a nurse');
    }

    const patient = await this.patientRepository.findByIdWithRelations(alert.caseId);
    if (!patient) throw new NotFoundException(`Patient ${alert.caseId} not found`);

    const roomCode = this.normalizeRoomCode(patient.roomBed);
    const isAssigned = await this.roomNurseRepository.isNurseAssignedToRoom(caller.id, roomCode);
    if (!isAssigned) {
      throw new ForbiddenException('You are not assigned to this patient room');
    }

    alert.status = 'HANDLED';
    alert.handledAt = new Date();
    alert.handledByUserId = caller.id;

    const saved = await this.repository.save(alert);
    await this.notifyPatientIfEligibleForUnlock(saved);
    return this.toResponse(saved);
  }

  async isAssessmentLocked(caseId: string, now = new Date()): Promise<boolean> {
    const latestRedAlert = await this.repository.findLatestRedAlertByCaseId(caseId);
    if (!latestRedAlert) return false;

    if (latestRedAlert.status === 'PENDING_REVIEW') return true;
    if (latestRedAlert.status !== 'HANDLED' || !latestRedAlert.triggeredAt) return false;

    return now < this.getUnlockAt(latestRedAlert.triggeredAt);
  }

  async notifyEligiblePatientsForUnlock(): Promise<void> {
    const eligibleThrough = new Date(Date.now() - RED_ASSESSMENT_LOCK_MINUTES * 60 * 1000);
    const alerts = await this.repository.findHandledRedAwaitingUnlockNotification(eligibleThrough);
    for (const alert of alerts) {
      await this.notifyPatientIfEligibleForUnlock(alert);
    }
  }

  async findPendingRedByCaseId(caseId: string): Promise<Alert | null> {
    return this.repository.findPendingRedByCaseId(caseId);
  }

  private normalizeRoomCode(roomBed: string | null): string {
    return (roomBed ?? '').split('/')[0].trim().toUpperCase();
  }

  private getUnlockAt(triggeredAt: Date): Date {
    return new Date(triggeredAt.getTime() + RED_ASSESSMENT_LOCK_MINUTES * 60 * 1000);
  }

  private async notifyPatientIfEligibleForUnlock(alert: Alert): Promise<void> {
    if (
      alert.alertType !== 'RED' ||
      alert.status !== 'HANDLED' ||
      !alert.triggeredAt ||
      alert.unlockNotifiedAt ||
      new Date() < this.getUnlockAt(alert.triggeredAt)
    ) {
      return;
    }

    await this.notificationService.sendToPatientCase(
      alert.caseId,
      'Bạn có thể đánh giá lại',
      'Điều dưỡng đã xử trí cảnh báo. Vui lòng mở ứng dụng để cập nhật tình trạng sức khỏe.',
      { caseId: alert.caseId, assessmentType: 'TRIGGERED' },
    );

    alert.unlockNotifiedAt = new Date();
    await this.repository.save(alert);
  }
}
