import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CareObservationService } from '../../care-observation/services/care-observation.service';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import {
  CreateTreatmentOrderDto,
  TreatmentOrderResponseDto,
  UpdateTreatmentOrderDto,
} from '../dtos/treatment-order.dto';
import { TreatmentOrder } from '../entities/treatment-order.entity';
import { TreatmentOrderRepository } from '../repositories/treatment-order.repository';

@Injectable()
export class TreatmentOrderService {
  constructor(
    private readonly repository: TreatmentOrderRepository,
    private readonly careObservationService: CareObservationService,
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
   */
  async createOrder(
    dto: CreateTreatmentOrderDto,
    actor: UserResponseDto,
  ): Promise<TreatmentOrderResponseDto> {
    const patient = await this.repository.findPatient(dto.caseId);
    if (!patient) {
      throw new NotFoundException(`Patient case ${dto.caseId} not found`);
    }

    const order = await this.dataSource.transaction(async (manager) => {
      // 1. The order itself — ordering doctor and timestamp are server-derived.
      const saved = await this.repository.save(
        {
          caseId: dto.caseId,
          careLevel: dto.careLevel,
          instructions: dto.instructions ?? null,
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

      return saved;
    });

    return this.toResponse(order, order.treatmentOrderId);
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
