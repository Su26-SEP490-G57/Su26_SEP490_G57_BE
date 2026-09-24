import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { CreateVitalSignDto } from '../dtos/create-vital-sign.dto';
import { QueryVitalSignDto } from '../dtos/query-vital-sign.dto';
import { PaginatedVitalSignsDto, VitalSignResponseDto } from '../dtos/vital-sign-response.dto';
import { VitalSign } from '../entities/vital-sign.entity';
import { VitalSignRepository } from '../repositories/vital-sign.repository';
import { PatientGateway } from '../../patient/gateways/patient.gateway';
import { NotificationService } from '../../alert/services/notification.service';
import { PatientRepository } from '../../patient/repositories/patient.repository';

@Injectable()
export class VitalSignsService {
  private readonly logger = new Logger(VitalSignsService.name);

  constructor(
    private readonly repository: VitalSignRepository,
    private readonly patientGateway: PatientGateway,
    private readonly notificationService: NotificationService,
    private readonly patientRepository: PatientRepository,
  ) {}

  async create(dto: CreateVitalSignDto, actor: UserResponseDto): Promise<VitalSignResponseDto> {
    if (!(await this.repository.patientExists(dto.caseId))) {
      throw new NotFoundException(`Patient case ${dto.caseId} not found`);
    }

    if (dto.bloodPressureSystolic <= dto.bloodPressureDiastolic) {
      throw new BadRequestException(
        'Systolic blood pressure must be greater than diastolic blood pressure',
      );
    }

    // Recorder identity and timestamp are server-derived, never client-supplied.
    const saved = await this.repository.save({
      caseId: dto.caseId,
      pulseBpm: dto.pulseBpm,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      temperatureCelsius: dto.temperatureCelsius,
      respiratoryRate: dto.respiratoryRate,
      spo2Percent: dto.spo2Percent,
      note: dto.note ?? null,
      recordedByUserId: actor.id,
      recordedByName: actor.fullName,
    });

    const response = this.toResponse(saved);

    // Broadcast real-time socket event on /patients namespace
    try {
      this.patientGateway.emitVitalSignsCreated(saved);
    } catch (error) {
      this.logger.error('Failed to emit vital_signs.created socket event', error);
    }

    // Best-effort: FCM push notification to doctors
    try {
      const patient = await this.patientRepository.findByIdWithRelations(saved.caseId);
      const patientName = patient?.account?.fullName ?? saved.caseId;
      await this.notificationService.sendToDoctors(
        'Cập nhật chỉ số sinh tồn',
        `Điều dưỡng ${actor.fullName} vừa cập nhật chỉ số sinh tồn mới cho ${patientName}.`,
        {
          route: '/doctor/alerts',
          caseId: saved.caseId,
          vitalSignId: String(saved.vitalSignId),
        },
      );
    } catch (error) {
      this.logger.error('Failed to send FCM push notification to doctors', error);
    }

    return response;
  }

  async getByCaseId(caseId: string, query: QueryVitalSignDto): Promise<PaginatedVitalSignsDto> {
    if (!(await this.repository.patientExists(caseId))) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [rows, total] = await this.repository.findByCaseId(caseId, page, limit);

    return { data: rows.map((row) => this.toResponse(row)), total, page, limit };
  }

  private toResponse(entity: VitalSign): VitalSignResponseDto {
    return {
      vitalSignId: entity.vitalSignId,
      caseId: entity.caseId,
      pulseBpm: entity.pulseBpm,
      bloodPressureSystolic: entity.bloodPressureSystolic,
      bloodPressureDiastolic: entity.bloodPressureDiastolic,
      temperatureCelsius: Number(entity.temperatureCelsius),
      respiratoryRate: entity.respiratoryRate,
      spo2Percent: entity.spo2Percent,
      note: entity.note ?? null,
      recordedByUserId: entity.recordedByUserId ?? null,
      recordedByName: entity.recordedByName,
      recordedAt: entity.recordedAt,
    };
  }
}
