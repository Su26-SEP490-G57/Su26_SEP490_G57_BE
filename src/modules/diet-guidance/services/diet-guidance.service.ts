import { Injectable, NotFoundException } from '@nestjs/common';
import { OperationType } from '../../patient/entities/operation-type.entity';
import {
  CreateOperationTypeDto,
  OperationTypeResponseDto,
  UpdateOperationTypeDto,
} from '../dtos/operation-type.dto';
import {
  CreatePodProtocolDto,
  PodProtocolResponseDto,
  UpdatePodProtocolDto,
} from '../dtos/pod-protocol.dto';
import { PodProtocol } from '../entities/pod-protocol.entity';
import { DietGuidanceRepository } from '../repositories/diet-guidance.repository';

@Injectable()
export class DietGuidanceService {
  constructor(private readonly repository: DietGuidanceRepository) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private toOpTypeResponse(op: OperationType, podCount = 0): OperationTypeResponseDto {
    return {
      id: op.operationTypeId,
      name: op.operationName,
      description: op.description,
      podCount,
    };
  }

  private toPodResponse(pod: PodProtocol): PodProtocolResponseDto {
    return {
      podId: pod.podId,
      operationTypeId: pod.operationTypeId,
      label: pod.label,
      mealsPerDayMin: pod.mealsPerDayMin,
      mealsPerDayMax: pod.mealsPerDayMax,
      mealInstruction: pod.mealInstruction,
      volumePerMealMin: pod.volumnPerMealMin,
      volumePerMealMax: pod.volumePerMealMax,
      volumeInstruction: pod.volumeInstruction,
      recommendedFoods: pod.recommendedFoods,
      recommendedDrinks: pod.recommendedDrinks,
      updatedAt: pod.updatedAt,
      createdAt: pod.createdAt,
    };
  }

  // ── Operation Types ──────────────────────────────────────────────────────────

  async getOperationTypes(): Promise<OperationTypeResponseDto[]> {
    const types = await this.repository.findAllOperationTypes();
    return Promise.all(
      types.map(async (t) => {
        const count = await this.repository.countPodsByOperationType(t.operationTypeId);
        return this.toOpTypeResponse(t, count);
      }),
    );
  }

  async createOperationType(dto: CreateOperationTypeDto): Promise<OperationTypeResponseDto> {
    const saved = await this.repository.saveOperationType({
      operationName: dto.name,
      description: dto.description ?? null,
    });
    return this.toOpTypeResponse(saved, 0);
  }

  async updateOperationType(
    id: number,
    dto: UpdateOperationTypeDto,
  ): Promise<OperationTypeResponseDto> {
    const op = await this.repository.findOperationTypeById(id);
    if (!op) throw new NotFoundException(`Operation type #${id} not found`);
    if (dto.name) op.operationName = dto.name;
    if (dto.description !== undefined) op.description = dto.description ?? null;
    const saved = await this.repository.saveOperationType(op);
    const count = await this.repository.countPodsByOperationType(id);
    return this.toOpTypeResponse(saved, count);
  }

  async deleteOperationType(id: number): Promise<void> {
    const op = await this.repository.findOperationTypeById(id);
    if (!op) throw new NotFoundException(`Operation type #${id} not found`);
    await this.repository.deleteOperationType(id);
  }

  // ── Pod Protocols ────────────────────────────────────────────────────────────

  async getPodsByOperationType(operationTypeId: number): Promise<PodProtocolResponseDto[]> {
    const op = await this.repository.findOperationTypeById(operationTypeId);
    if (!op) throw new NotFoundException(`Operation type #${operationTypeId} not found`);
    const pods = await this.repository.findPodsByOperationType(operationTypeId);
    return pods.map((p) => this.toPodResponse(p));
  }

  async getPodById(operationTypeId: number, podId: number): Promise<PodProtocolResponseDto> {
    const pod = await this.repository.findPodById(podId);
    if (!pod || pod.operationTypeId !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }
    return this.toPodResponse(pod);
  }

  async createPod(
    operationTypeId: number,
    dto: CreatePodProtocolDto,
    userId: number,
  ): Promise<PodProtocolResponseDto> {
    const op = await this.repository.findOperationTypeById(operationTypeId);
    if (!op) throw new NotFoundException(`Operation type #${operationTypeId} not found`);

    const saved = await this.repository.savePod({
      operationTypeId,
      label: dto.label,
      mealsPerDayMin: dto.mealsPerDayMin ?? null,
      mealsPerDayMax: dto.mealsPerDayMax ?? null,
      mealInstruction: dto.mealInstruction ?? null,
      volumnPerMealMin: dto.volumePerMealMin ?? null,
      volumePerMealMax: dto.volumePerMealMax ?? null,
      volumeInstruction: dto.volumeInstruction ?? null,
      recommendedFoods: dto.recommendedFoods ?? [],
      recommendedDrinks: dto.recommendedDrinks ?? [],
      updatedBy: { id: userId },
    });
    return this.toPodResponse(saved);
  }

  async updatePod(
    operationTypeId: number,
    podId: number,
    dto: UpdatePodProtocolDto,
    userId: number,
  ): Promise<PodProtocolResponseDto> {
    const pod = await this.repository.findPodById(podId);
    if (!pod || pod.operationTypeId !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }

    const updates = {
      ...(dto.label && { label: dto.label }),
      ...(dto.mealsPerDayMin !== undefined && { mealsPerDayMin: dto.mealsPerDayMin ?? null }),
      ...(dto.mealsPerDayMax !== undefined && { mealsPerDayMax: dto.mealsPerDayMax ?? null }),
      ...(dto.mealInstruction !== undefined && { mealInstruction: dto.mealInstruction ?? null }),
      ...(dto.volumePerMealMin !== undefined && { volumnPerMealMin: dto.volumePerMealMin ?? null }), // Lưu ý chữ 'volumn' ở đây
      ...(dto.volumePerMealMax !== undefined && { volumePerMealMax: dto.volumePerMealMax ?? null }),
      ...(dto.volumeInstruction !== undefined && {
        volumeInstruction: dto.volumeInstruction ?? null,
      }),
      ...(dto.recommendedFoods !== undefined && { recommendedFoods: dto.recommendedFoods }),
      ...(dto.recommendedDrinks !== undefined && { recommendedDrinks: dto.recommendedDrinks }),
      updatedBy: { id: userId },
    };

    Object.assign(pod, updates);

    const saved = await this.repository.savePod(pod);
    return this.toPodResponse(saved);
  }

  async deletePod(operationTypeId: number, podId: number): Promise<void> {
    const pod = await this.repository.findPodById(podId);
    if (!pod || pod.operationTypeId !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }
    await this.repository.deletePod(podId);
  }
}
