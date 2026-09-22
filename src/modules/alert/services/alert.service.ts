import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PatientRepository } from 'src/modules/patient/repositories/patient.repository';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { AlertResponseDto, PaginatedAlertsDto } from '../dtos/alert-response.dto';
import { CreateAlertDto } from '../dtos/create-alert.dto';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { Alert } from '../entities/alert.entity';
import { AlertGateway } from '../gateways/alert.gateway';
import { AlertRepository } from '../repositories/alert.repository';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';
import { NotificationService } from './notification.service';
import { YellowReminderService } from '../../reminder/services/yellow-reminder.service';

const RED_ASSESSMENT_LOCK_MINUTES = 60;

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly repository: AlertRepository,
    private readonly alertGateway: AlertGateway,
    private readonly notificationService: NotificationService,
    private readonly patientRepository: PatientRepository,
    private readonly roomNurseRepository: RoomNurseAssignmentRepository,
    private readonly yellowReminderService: YellowReminderService,
  ) {}

  private toResponse(alert: Alert): AlertResponseDto {
    const isPending = alert.status === 'PENDING_REVIEW';
    const isOverdue =
      isPending && alert.triggeredAt
        ? new Date().getTime() - alert.triggeredAt.getTime() >
          RED_ASSESSMENT_LOCK_MINUTES * 60 * 1000
        : false;

    return {
      alertId: alert.alertId,
      caseId: alert.caseId,
      assessmentId: alert.assessmentId,
      alertType: alert.alertType,
      status: alert.status === 'PENDING_REVIEW' ? 'Đang chờ xử trí' : 'Đã xử trí',
      isOverdue,
      isAutoProgression: alert.isAutoProgression,
      triggeredAt: alert.triggeredAt,
      handledAt: alert.handledAt,
      nurseAction: alert.nurseAction,
      nursingNote: alert.nursingNote,
      handledByUserId: alert.handledByUserId,
      closedAt: alert.closedAt,
    };
  }

  async createAlert(dto: CreateAlertDto): Promise<AlertResponseDto> {
    // Critical path: Alert persistence is non-negotiable for audit trail
    let saved: Alert;
    try {
      saved = await this.repository.save({
        caseId: dto.caseId,
        assessmentId: dto.assessmentId,
        alertType: dto.alertType,
        status: 'PENDING_REVIEW',
        isAutoProgression: true,
        triggeredAt: new Date(),
      });
      this.logger.log('Alert created', {
        alertId: saved.alertId,
        caseId: saved.caseId,
        type: saved.alertType,
      });
    } catch (error) {
      this.logger.error(
        'CRITICAL: Failed to save alert',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    const response = this.toResponse(saved);

    // Best-effort: WebSocket emit for real-time dashboard
    try {
      this.alertGateway.emitNewAlert(response);
    } catch (error) {
      this.logger.error(
        `WebSocket emit failed for alert #${saved.alertId} - Dashboard can still query from DB`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Best-effort: FCM notifications for RED alerts
    if (saved.alertType === 'RED') {
      try {
        const patient = await this.patientRepository.findByIdWithRelations(saved.caseId);
        const patientName = patient?.account?.fullName ?? saved.caseId;
        const room = patient?.roomBed ?? '';
        const roomCode = room.split('/')[0].trim().toUpperCase();

        const pushTitle = '🔴 Cảnh báo khẩn';
        const pushBody = `${patientName} • ${room} • Mức đỏ`;
        const assignedNurseIds = await this.roomNurseRepository.getAssignedNurses(roomCode);

        if (assignedNurseIds.length > 0) {
          await this.notificationService.sendToNursesSpecific(
            assignedNurseIds,
            pushTitle,
            pushBody,
            {
              caseId: saved.caseId,
              assessmentId: String(saved.assessmentId),
              patientName,
              roomBed: room,
              alertType: saved.alertType,
            },
          );
          this.logger.log('RED alert FCM sent', {
            alertId: saved.alertId,
            nurseCount: assignedNurseIds.length,
          });
        } else {
          // Fallback: broadcast to all nurses if room has no assignment
          await this.notificationService.sendToNurses(pushTitle, pushBody, {
            caseId: saved.caseId,
            assessmentId: String(saved.assessmentId),
            patientName,
            roomBed: room,
            alertType: saved.alertType,
          });
          this.logger.warn('RED alert broadcast (no room assignment)', {
            alertId: saved.alertId,
            roomCode,
          });
        }
      } catch (error) {
        this.logger.error(
          `FCM notification failed for alert #${saved.alertId} - Alert still visible on dashboard`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Best-effort: Schedule YELLOW reminder
    if (saved.alertType === 'YELLOW') {
      try {
        await this.yellowReminderService.scheduleReminder(saved.caseId, saved.alertId);
        this.logger.log('YELLOW reminder scheduled', { alertId: saved.alertId });
      } catch (error) {
        this.logger.error(
          `Failed to schedule YELLOW reminder for alert #${saved.alertId}`,
          error instanceof Error ? error.stack : String(error),
        );
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

  async getDoctorNotifications(query: QueryAlertDto): Promise<PaginatedAlertsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [alerts, total] = await this.repository.findHandledForDoctor(page, limit);

    return {
      data: alerts.map((alert) => this.toResponse(alert)),
      total,
      page,
      limit,
    };
  }

  async handleAlert(alertId: number, caller: UserResponseDto): Promise<AlertResponseDto> {
    const alert = await this.repository.findById(alertId);
    if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

    if (alert.status === 'HANDLED') {
      return this.toResponse(alert);
    }

    if (alert.status !== 'PENDING_REVIEW') {
      throw new ForbiddenException('Only pending alerts can be handled by a nurse');
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
    const response = this.toResponse(saved);

    // Cancel YELLOW reminder if alert is handled before 2 hours
    if (saved.alertType === 'YELLOW') {
      await this.yellowReminderService.cancelReminder(saved.alertId);
    }

    this.alertGateway.emitAlertHandled(response);

    try {
      const patientDetails = await this.patientRepository.findByIdWithRelations(saved.caseId);
      const patientName = patientDetails?.account?.fullName ?? saved.caseId;
      await this.notificationService.sendToDoctors(
        'Đã hoàn thành xử trí',
        `Điều dưỡng đã hoàn thành xử trí cảnh báo cho ${patientName}.`,
        {
          route: '/doctor/alerts',
          caseId: saved.caseId,
          assessmentId: String(saved.assessmentId),
          alertId: String(saved.alertId),
          alertType: saved.alertType,
        },
      );
    } catch (error) {
      this.logger.error(
        `Unable to notify doctors for handled alert #${saved.alertId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return response;
  }

  async isAssessmentLocked(caseId: string, now = new Date()): Promise<boolean> {
    const latestRedAlert = await this.repository.findLatestRedAlertByCaseId(caseId);
    if (!latestRedAlert) return false;

    // Fail safe: after any RED alert, assessment remains locked until both
    // clinical safeguards are proven — nurse handling and elapsed cooldown.
    if (latestRedAlert.status !== 'HANDLED' || !latestRedAlert.triggeredAt) return true;

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

    const result = await this.notificationService.sendToPatientCase(
      alert.caseId,
      'Bạn có thể đánh giá lại',
      'Điều dưỡng đã xử trí cảnh báo. Vui lòng mở ứng dụng để cập nhật tình trạng sức khỏe.',
      { caseId: alert.caseId, assessmentType: 'TRIGGERED' },
    );

    // Only mark as notified if at least one delivery attempt succeeded.
    // If FCM fails entirely, the caller (PatientReminderScheduler) will retry
    // on the next cycle, and unlockNotifiedAt stays null so the patient
    // receives another push notification later.
    if (result.sent > 0) {
      alert.unlockNotifiedAt = new Date();
      await this.repository.save(alert);
    }
  }

  async updateAlertsOnReassessment(
    caseId: string,
    triageColor: string,
    assessmentId?: number,
  ): Promise<void> {
    const pendingAlerts = await this.repository.findAllPendingByCaseId(caseId);

    if (pendingAlerts.length > 0) {
      for (const alert of pendingAlerts) {
        if (triageColor === 'GREEN') {
          // Bệnh nhân ổn định -> Đánh dấu cảnh báo đã được xử lý thành công
          alert.status = 'HANDLED';
          alert.handledAt = new Date();
          alert.nursingNote = 'Đã cập nhật trạng thái người bệnh về Ổn định (GREEN).';
        } else {
          // Cập nhật loại cảnh báo (RED hoặc YELLOW) theo triage color mới
          alert.alertType = triageColor as 'RED' | 'YELLOW';
        }

        const saved = await this.repository.save(alert);
        this.alertGateway.emitNewAlert(this.toResponse(saved));
      }
    } else if (
      (triageColor === 'RED' || triageColor === 'YELLOW') &&
      assessmentId &&
      assessmentId > 0
    ) {
      // Bệnh nhân chưa có cảnh báo pending nhưng vừa được đánh giá lại sang RED hoặc YELLOW
      const saved = await this.repository.save({
        caseId: caseId,
        assessmentId: assessmentId,
        alertType: triageColor,
        status: 'PENDING_REVIEW',
        isAutoProgression: false,
        triggeredAt: new Date(),
      });

      this.alertGateway.emitNewAlert(this.toResponse(saved));
    }
  }
}
