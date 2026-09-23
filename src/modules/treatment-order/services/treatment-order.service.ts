import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CareObservationService } from '../../care-observation/services/care-observation.service';
import { PatientSheetHeaderService } from '../../his/patient-sheet-header.service';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { VitalSign } from '../../vital-signs/entities/vital-sign.entity';
import { HisTreatmentSheetClient } from '../clients/his-treatment-sheet.client';
import {
  CreateTreatmentOrderDto,
  TreatmentOrderResponseDto,
  UpdateTreatmentOrderDto,
} from '../dtos/treatment-order.dto';
import { TreatmentSheetDto, TreatmentSheetPrefillDto } from '../dtos/treatment-sheet.dto';
import { TreatmentOrder } from '../entities/treatment-order.entity';
import { TreatmentOrderRepository } from '../repositories/treatment-order.repository';

const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class TreatmentOrderService {
  constructor(
    private readonly repository: TreatmentOrderRepository,
    private readonly careObservationService: CareObservationService,
    private readonly hisClient: HisTreatmentSheetClient,
    private readonly sheetHeader: PatientSheetHeaderService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Doctor sets a care level for a case.
   *
   * The three writes (order row → patient mirror columns → care observation
   * sheet assignment) are wrapped in a single transaction: a half-applied order
   * would leave the nursing workflow pointing at the wrong sheet. This is a
   * deliberate deviation from the codebase's current non-transactional
   * multi-write style, limited to this flow.
   *
   * The "Phiếu theo dõi điều trị" is written to the HIS as the last step
   * inside the transaction: if the HIS rejects it, the local order is rolled
   * back so an order never exists without its sheet.
   */
  async createOrder(
    dto: CreateTreatmentOrderDto,
    actor: UserResponseDto,
  ): Promise<TreatmentOrderResponseDto> {
    const patient = await this.repository.findPatient(dto.caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${dto.caseId} not found`);
    }

    const header = await this.sheetHeader.build(patient);
    const instructions = dto.instructions.trim();

    const { order, sheet } = await this.dataSource.transaction(async (manager) => {
      // 1. The order itself — ordering doctor and timestamp are server-derived.
      const saved = await this.repository.save(
        {
          caseId: dto.caseId,
          careLevel: dto.careLevel,
          instructions,
          orderedByUserId: actor.id,
          orderedByName: actor.fullName,
        },
        manager,
      );

      // 2. Mirror onto the patient case so every patient response carries it.
      await this.repository.setActiveOrderOnPatient(
        dto.caseId,
        dto.careLevel,
        saved.treatmentOrderId,
        manager,
      );

      // 3. Assign / supersede the nursing Care Observation Sheet.
      await this.careObservationService.assignSheetForCareLevel(
        dto.caseId,
        dto.careLevel,
        saved.treatmentOrderId,
        manager,
      );

      // 4. Store the sheet in the HIS (system of record for the sheet).
      const hisSheet = await this.hisClient.create({
        patientCode: dto.caseId,
        patientName: header.patientName,
        facility: header.facility,
        department: header.department,
        diagnosis: dto.sheet.diagnosis?.trim() || header.diagnosis || undefined,
        comorbidities: this.joinComorbidities(dto.sheet.comorbidities ?? header.comorbidities),
        age: header.age ?? undefined,
        gender: header.gender ?? undefined,
        room: header.room ?? undefined,
        bed: header.bed ?? undefined,
        recordedAt: dto.sheet.recordedAt.toISOString(),
        progressNotes: dto.sheet.progressNotes.trim(),
        orders: instructions,
        careLevel: dto.careLevel,
        doctorName: actor.fullName,
        externalOrderId: saved.treatmentOrderId,
      });

      return { order: saved, sheet: hisSheet };
    });

    return { ...this.toResponse(order, order.treatmentOrderId), sheet };
  }

  /** Everything the "Phiếu theo dõi điều trị" form auto-fills. */
  async getSheetPrefill(caseId: string): Promise<TreatmentSheetPrefillDto> {
    const patient = await this.repository.findPatient(caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }

    const [header, latestVitalSign, diagnosisOptions, sheetNumber] = await Promise.all([
      this.sheetHeader.build(patient),
      this.sheetHeader.findLatestVitalSign(caseId),
      this.repository.findDiagnosisOptions(),
      this.hisClient.nextSheetNumber(caseId),
    ]);

    const options = header.diagnosis
      ? [header.diagnosis, ...diagnosisOptions.filter((d) => d !== header.diagnosis)]
      : diagnosisOptions;

    return {
      sheetNumber,
      caseId,
      ...header,
      diagnosisOptions: options,
      progressNotes: latestVitalSign ? this.formatVitalSign(latestVitalSign) : '',
      latestVitalSignAt: latestVitalSign?.recordedAt ?? null,
      activeCareLevel: patient.activeCareLevel ?? null,
    };
  }

  async getSheets(caseId: string): Promise<TreatmentSheetDto[]> {
    const patient = await this.repository.findPatient(caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }
    return this.hisClient.listByPatient(caseId);
  }

  /** HIS stores "Bệnh kèm theo" as text. */
  private joinComorbidities(items: string[]): string | undefined {
    const joined = items
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ');
    return joined || undefined;
  }

  /** Seed text for "Diễn biến bệnh" from a vital-signs record. */
  private formatVitalSign(v: VitalSign): string {
    const at = new Intl.DateTimeFormat('vi-VN', {
      timeZone: DISPLAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(v.recordedAt);

    const lines = [
      `Chỉ số sinh tồn (ghi nhận ${at} - ${v.recordedByName}):`,
      `- Mạch: ${v.pulseBpm} lần/phút`,
      `- Huyết áp: ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic} mmHg`,
      `- Nhiệt độ: ${Number(v.temperatureCelsius)} °C`,
      `- Nhịp thở: ${v.respiratoryRate} lần/phút`,
      `- SpO2: ${v.spo2Percent}%`,
    ];
    if (v.note?.trim()) lines.push(`- Ghi chú: ${v.note.trim()}`);
    return `${lines.join('\n')}\n`;
  }

  /**
   * Amend the currently active order. Historical orders are immutable — a
   * superseded order can only be replaced by issuing a new one.
   */
  async updateOrder(
    treatmentOrderId: number,
    dto: UpdateTreatmentOrderDto,
    actor: UserResponseDto,
  ): Promise<TreatmentOrderResponseDto> {
    const existing = await this.repository.findById(treatmentOrderId);
    if (!existing) {
      throw new NotFoundException(`Treatment order ${treatmentOrderId} not found`);
    }

    const patient = await this.repository.findPatient(existing.caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${existing.caseId} not found`);
    }
    if (patient.activeTreatmentOrderId !== treatmentOrderId) {
      throw new ConflictException(
        `Treatment order ${treatmentOrderId} is no longer the active order for case ${existing.caseId} and can no longer be edited`,
      );
    }

    const careLevel = dto.careLevel ?? existing.careLevel;

    const updated = await this.dataSource.transaction(async (manager) => {
      const saved = await this.repository.save(
        {
          treatmentOrderId,
          careLevel,
          instructions: dto.instructions === undefined ? existing.instructions : dto.instructions,
          // Keep the audit trail on who last touched the order.
          orderedByUserId: actor.id,
          orderedByName: actor.fullName,
        },
        manager,
      );

      await this.repository.setActiveOrderOnPatient(
        existing.caseId,
        careLevel,
        treatmentOrderId,
        manager,
      );

      await this.careObservationService.assignSheetForCareLevel(
        existing.caseId,
        careLevel,
        treatmentOrderId,
        manager,
      );

      return saved;
    });

    return this.toResponse({ ...existing, ...updated }, treatmentOrderId);
  }

  async getByCaseId(caseId: string): Promise<TreatmentOrderResponseDto[]> {
    const patient = await this.repository.findPatient(caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }

    const orders = await this.repository.findByCaseId(caseId);
    return orders.map((order) => this.toResponse(order, patient.activeTreatmentOrderId));
  }

  private toResponse(
    entity: TreatmentOrder,
    activeTreatmentOrderId: number | null,
  ): TreatmentOrderResponseDto {
    return {
      treatmentOrderId: entity.treatmentOrderId,
      caseId: entity.caseId,
      careLevel: entity.careLevel,
      instructions: entity.instructions ?? null,
      orderedByUserId: entity.orderedByUserId ?? null,
      orderedByName: entity.orderedByName,
      orderedAt: entity.orderedAt,
      updatedAt: entity.updatedAt ?? null,
      isActive: entity.treatmentOrderId === activeTreatmentOrderId,
    };
  }
}
