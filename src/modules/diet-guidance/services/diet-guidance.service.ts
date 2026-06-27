import { Injectable, NotFoundException } from '@nestjs/common';
import { OperationType } from '../../patient/entities/operation-type.entity';
import { CreateOperationTypeDto, OperationTypeResponseDto, UpdateOperationTypeDto } from '../dtos/operation-type.dto';
import { CreatePodProtocolDto, PodProtocolResponseDto, UpdatePodProtocolDto } from '../dtos/pod-protocol.dto';
import { PodProtocol } from '../entities/pod-protocol.entity';
import { DietGuidanceRepository } from '../repositories/diet-guidance.repository';

@Injectable()
export class DietGuidanceService {
  constructor(private readonly repository: DietGuidanceRepository) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private toOpTypeResponse(op: OperationType, podCount = 0): OperationTypeResponseDto {
    return {
      id: op.operation_type_id,
      name: op.operation_name,
      description: op.description,
      podCount,
    };
  }

  private toPodResponse(pod: PodProtocol): PodProtocolResponseDto {
    return {
      podId: pod.pod_id,
      operationTypeId: pod.operation_type_id,
      label: pod.label,
      mealsPerDayMin: pod.meals_per_day_min,
      mealsPerDayMax: pod.meals_per_day_max,
      mealInstruction: pod.meal_instruction,
      volumePerMealMin: pod.volume_per_meal_min,
      volumePerMealMax: pod.volume_per_meal_max,
      volumeInstruction: pod.volume_instruction,
      recommendedFoods: pod.recommended_foods,
      recommendedDrinks: pod.recommended_drinks,
      updatedAt: pod.updated_at,
      createdAt: pod.created_at,
    };
  }

  // ── Operation Types ──────────────────────────────────────────────────────────

  async getOperationTypes(): Promise<OperationTypeResponseDto[]> {
    const types = await this.repository.findAllOperationTypes();
    return Promise.all(
      types.map(async (t) => {
        const count = await this.repository.countPodsByOperationType(t.operation_type_id);
        return this.toOpTypeResponse(t, count);
      }),
    );
  }

  async createOperationType(dto: CreateOperationTypeDto): Promise<OperationTypeResponseDto> {
    const saved = await this.repository.saveOperationType({
      operation_name: dto.name,
      description: dto.description ?? null,
    });
    return this.toOpTypeResponse(saved, 0);
  }

  async updateOperationType(id: number, dto: UpdateOperationTypeDto): Promise<OperationTypeResponseDto> {
    const op = await this.repository.findOperationTypeById(id);
    if (!op) throw new NotFoundException(`Operation type #${id} not found`);
    if (dto.name) op.operation_name = dto.name;
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
    if (!pod || pod.operation_type_id !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }
    return this.toPodResponse(pod);
  }

  async createPod(operationTypeId: number, dto: CreatePodProtocolDto, userId: number): Promise<PodProtocolResponseDto> {
    const op = await this.repository.findOperationTypeById(operationTypeId);
    if (!op) throw new NotFoundException(`Operation type #${operationTypeId} not found`);

    const saved = await this.repository.savePod({
      operation_type_id: operationTypeId,
      label: dto.label,
      meals_per_day_min: dto.mealsPerDayMin ?? null,
      meals_per_day_max: dto.mealsPerDayMax ?? null,
      meal_instruction: dto.mealInstruction ?? null,
      volume_per_meal_min: dto.volumePerMealMin ?? null,
      volume_per_meal_max: dto.volumePerMealMax ?? null,
      volume_instruction: dto.volumeInstruction ?? null,
      recommended_foods: dto.recommendedFoods ?? [],
      recommended_drinks: dto.recommendedDrinks ?? [],
      updatedBy: { id: userId } as any,
    });
    return this.toPodResponse(saved);
  }

  async updatePod(operationTypeId: number, podId: number, dto: UpdatePodProtocolDto, userId: number): Promise<PodProtocolResponseDto> {
    const pod = await this.repository.findPodById(podId);
    if (!pod || pod.operation_type_id !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }

    if (dto.label) pod.label = dto.label;
    if (dto.mealsPerDayMin !== undefined) pod.meals_per_day_min = dto.mealsPerDayMin ?? null;
    if (dto.mealsPerDayMax !== undefined) pod.meals_per_day_max = dto.mealsPerDayMax ?? null;
    if (dto.mealInstruction !== undefined) pod.meal_instruction = dto.mealInstruction ?? null;
    if (dto.volumePerMealMin !== undefined) pod.volume_per_meal_min = dto.volumePerMealMin ?? null;
    if (dto.volumePerMealMax !== undefined) pod.volume_per_meal_max = dto.volumePerMealMax ?? null;
    if (dto.volumeInstruction !== undefined) pod.volume_instruction = dto.volumeInstruction ?? null;
    if (dto.recommendedFoods !== undefined) pod.recommended_foods = dto.recommendedFoods;
    if (dto.recommendedDrinks !== undefined) pod.recommended_drinks = dto.recommendedDrinks;
    pod.updatedBy = { id: userId } as any;

    const saved = await this.repository.savePod(pod);
    return this.toPodResponse(saved);
  }

  async deletePod(operationTypeId: number, podId: number): Promise<void> {
    const pod = await this.repository.findPodById(podId);
    if (!pod || pod.operation_type_id !== operationTypeId) {
      throw new NotFoundException(`Pod #${podId} not found`);
    }
    await this.repository.deletePod(podId);
  }
}
