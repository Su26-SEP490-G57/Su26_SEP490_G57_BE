import { Injectable, NotFoundException } from '@nestjs/common';
import { AcknowledgeAlertDto } from '../dtos/acknowledge-alert.dto';
import { AlertResponseDto, PaginatedAlertsDto } from '../dtos/alert-response.dto';
import { CreateAlertDto } from '../dtos/create-alert.dto';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { Alert } from '../entities/alert.entity';
import { AlertGateway } from '../gateways/alert.gateway';
import { AlertRepository } from '../repositories/alert.repository';
import { NotificationService } from './notification.service';
import { PatientRepository } from 'src/modules/patient/repositories/patient.repository';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';

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

    const patient = await this.patientRepository.findByIdWithRelations(saved.caseId);
    const patientName = patient?.account?.fullName ?? saved.caseId;
    const room = patient?.roomBed ?? '';
    const roomCode = room.split('/')[0].trim().toUpperCase();

    // Emit real-time alert to all connected nurses
    this.alertGateway.emitNewAlert(response);

    const pushTitle = saved.alertType === 'RED' ? '🔴 Cảnh báo khẩn' : '🟡 Cần theo dõi';
    const pushBody = `${patientName} • ${room} • ${
      saved.alertType === 'RED' ? 'Mức đỏ' : 'Mức vàng'
    }`;

    // Push Notification cho Mobile: fan-out tới ONLY nurses ĐƯỢC GÁN phòng
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

  async acknowledgeAlert(alertId: number, dto: AcknowledgeAlertDto): Promise<AlertResponseDto> {
    const alert = await this.repository.findById(alertId);
    if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

    alert.status = 'HANDLED';
    alert.handledAt = new Date();
    if (dto.nurseAction !== undefined) alert.nurseAction = dto.nurseAction;
    if (dto.nursingNote !== undefined) alert.nursingNote = dto.nursingNote;

    const saved = await this.repository.save(alert);
    return this.toResponse(saved);
  }

  async findPendingRedByCaseId(caseId: string): Promise<Alert | null> {
    return this.repository.findPendingRedByCaseId(caseId);
  }
}
