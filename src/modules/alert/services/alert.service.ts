import { Injectable, NotFoundException } from '@nestjs/common';
import { AcknowledgeAlertDto } from '../dtos/acknowledge-alert.dto';
import { AlertResponseDto, PaginatedAlertsDto } from '../dtos/alert-response.dto';
import { CreateAlertDto } from '../dtos/create-alert.dto';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { Alert } from '../entities/alert.entity';
import { AlertGateway } from '../gateways/alert.gateway';
import { AlertRepository } from '../repositories/alert.repository';

@Injectable()
export class AlertService {
  constructor(
    private readonly repository: AlertRepository,
    private readonly alertGateway: AlertGateway,
  ) {}

  private toResponse(alert: Alert): AlertResponseDto {
    return {
      alert_id: alert.alert_id,
      case_id: alert.case_id,
      assessment_id: alert.assessment_id,
      survey_score: alert.survey_score,
      alert_type: alert.alert_type,
      status: alert.status,
      is_auto_progression: alert.is_auto_progression,
      triggered_at: alert.triggered_at,
      nurse_action: alert.nurse_action,
      nursing_note: alert.nursing_note,
      closed_at: alert.closed_at,
    };
  }

  async createAlert(dto: CreateAlertDto): Promise<AlertResponseDto> {
    const saved = await this.repository.save({
      case_id: dto.caseId,
      assessment_id: dto.assessmentId,
      survey_score: dto.surveyScore,
      alert_type: dto.alertType,
      status: 'Pending',
      is_auto_progression: true,
      triggered_at: new Date(),
    });

    const response = this.toResponse(saved);

    // Emit real-time alert to all connected nurses
    this.alertGateway.emitNewAlert(response);

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

    alert.status = 'Acknowledged';
    if (dto.nurse_action !== undefined) alert.nurse_action = dto.nurse_action;
    if (dto.nursing_note !== undefined) alert.nursing_note = dto.nursing_note;

    const saved = await this.repository.save(alert);
    return this.toResponse(saved);
  }
}
