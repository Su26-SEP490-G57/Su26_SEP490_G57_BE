import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      dietLevel: pod.dietLevel ?? 0,
      mealsPerDayMin: pod.mealsPerDayMin,
      mealsPerDayMax: pod.mealsPerDayMax,
      mealInstruction: pod.mealInstruction,
      volumePerMealMin: pod.volumnPerMealMin,
      volumePerMealMax: pod.volumePerMealMax,
      volumeInstruction: pod.volumeInstruction,
      recommendedFoods: pod.recommendedFoods ?? [],
      recommendedDrinks: pod.recommendedDrinks ?? [],
      forbiddenFoods: pod.forbiddenFoods ?? [],
      forbiddenDrinks: pod.forbiddenDrinks ?? [],
      upgradeCriteria: pod.upgradeCriteria ?? [],
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

  async getOperationTypeById(id: number): Promise<OperationTypeResponseDto> {
    const op = await this.repository.findOperationTypeById(id);
    if (!op) throw new NotFoundException(`Operation type #${id} not found`);
    const count = await this.repository.countPodsByOperationType(id);
    return this.toOpTypeResponse(op, count);
  }

  async createOperationType(dto: CreateOperationTypeDto): Promise<OperationTypeResponseDto> {
    // Check duplicate name
    const existing = await this.repository.findOperationTypeByName(dto.name);
    if (existing) {
      throw new ConflictException(`Operation type with name "${dto.name}" already exists`);
    }

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

    // Check duplicate name (if name is being changed)
    if (dto.name && dto.name !== op.operationName) {
      const existing = await this.repository.findOperationTypeByName(dto.name, id);
      if (existing) {
        throw new ConflictException(`Operation type with name "${dto.name}" already exists`);
      }
    }

    if (dto.name) op.operationName = dto.name;
    if (dto.description !== undefined) op.description = dto.description ?? null;
    const saved = await this.repository.saveOperationType(op);
    const count = await this.repository.countPodsByOperationType(id);
    return this.toOpTypeResponse(saved, count);
  }

  async deleteOperationType(id: number): Promise<void> {
    const op = await this.repository.findOperationTypeById(id);
    if (!op) throw new NotFoundException(`Operation type #${id} not found`);

    // Check if any patients are using this operation type
    const patientCount = await this.repository.countPatientsByOperationType(id);
    if (patientCount > 0) {
      throw new ConflictException(
        `Cannot delete operation type. ${patientCount} active patient(s) are currently using it.`,
      );
    }

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

    // Validate min <= max for meals per day
    if (
      dto.mealsPerDayMin !== undefined &&
      dto.mealsPerDayMax !== undefined &&
      dto.mealsPerDayMin !== null &&
      dto.mealsPerDayMax !== null &&
      dto.mealsPerDayMin > dto.mealsPerDayMax
    ) {
      throw new BadRequestException('mealsPerDayMin cannot be greater than mealsPerDayMax');
    }

    // Validate min <= max for volume per meal
    if (
      dto.volumePerMealMin !== undefined &&
      dto.volumePerMealMax !== undefined &&
      dto.volumePerMealMin !== null &&
      dto.volumePerMealMax !== null &&
      dto.volumePerMealMin > dto.volumePerMealMax
    ) {
      throw new BadRequestException('volumePerMealMin cannot be greater than volumePerMealMax');
    }

    const saved = await this.repository.savePod({
      operationTypeId,
      label: dto.label,
      dietLevel: dto.dietLevel ?? 0,
      mealsPerDayMin: dto.mealsPerDayMin ?? null,
      mealsPerDayMax: dto.mealsPerDayMax ?? null,
      mealInstruction: dto.mealInstruction ?? null,
      volumnPerMealMin: dto.volumePerMealMin ?? null,
      volumePerMealMax: dto.volumePerMealMax ?? null,
      volumeInstruction: dto.volumeInstruction ?? null,
      recommendedFoods: dto.recommendedFoods ?? [],
      recommendedDrinks: dto.recommendedDrinks ?? [],
      forbiddenFoods: dto.forbiddenFoods ?? [],
      forbiddenDrinks: dto.forbiddenDrinks ?? [],
      upgradeCriteria: dto.upgradeCriteria ?? [],
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

    // Prepare values for validation
    const newMealsMin = dto.mealsPerDayMin !== undefined ? dto.mealsPerDayMin : pod.mealsPerDayMin;
    const newMealsMax = dto.mealsPerDayMax !== undefined ? dto.mealsPerDayMax : pod.mealsPerDayMax;
    const newVolumeMin =
      dto.volumePerMealMin !== undefined ? dto.volumePerMealMin : pod.volumnPerMealMin;
    const newVolumeMax =
      dto.volumePerMealMax !== undefined ? dto.volumePerMealMax : pod.volumePerMealMax;

    // Validate min <= max for meals per day
    if (
      newMealsMin !== null &&
      newMealsMax !== null &&
      newMealsMin !== undefined &&
      newMealsMax !== undefined &&
      newMealsMin > newMealsMax
    ) {
      throw new BadRequestException('mealsPerDayMin cannot be greater than mealsPerDayMax');
    }

    // Validate min <= max for volume per meal
    if (
      newVolumeMin !== null &&
      newVolumeMax !== null &&
      newVolumeMin !== undefined &&
      newVolumeMax !== undefined &&
      newVolumeMin > newVolumeMax
    ) {
      throw new BadRequestException('volumePerMealMin cannot be greater than volumePerMealMax');
    }

    const updates = {
      ...(dto.label && { label: dto.label }),
      ...(dto.dietLevel !== undefined && { dietLevel: dto.dietLevel }),
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
      ...(dto.forbiddenFoods !== undefined && { forbiddenFoods: dto.forbiddenFoods }),
      ...(dto.forbiddenDrinks !== undefined && { forbiddenDrinks: dto.forbiddenDrinks }),
      ...(dto.upgradeCriteria !== undefined && { upgradeCriteria: dto.upgradeCriteria }),
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

    // Extract POD number from label (e.g., "POD 0" -> 0, "POD 1" -> 1)
    // We need to find patients at this POD level
    const pods = await this.repository.findPodsByOperationType(operationTypeId);
    const sortedPods = pods.sort((a, b) => {
      const aNum = parseInt(a.label.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(b.label.match(/\d+/)?.[0] || '0');
      return aNum - bNum;
    });

    const podIndex = sortedPods.findIndex((p) => p.podId === podId);
    if (podIndex >= 0) {
      const patientCount = await this.repository.countPatientsByPodLevel(operationTypeId, podIndex);
      if (patientCount > 0) {
        throw new ConflictException(
          `Cannot delete POD protocol. ${patientCount} active patient(s) are currently at this POD level.`,
        );
      }
    }

    await this.repository.deletePod(podId);
  }

  async getCurrentDietGuidanceForPatient(caseId: string): Promise<PodProtocolResponseDto | null> {
    const patient = await this.repository.findPatientByCaseId(caseId);
    if (!patient || patient.operationTypeId === null || patient.operationTypeId === undefined) {
      return null;
    }

    const dietLevel = patient.currentDietLevel ?? 0;
    const pod = await this.repository.findPodByOperationAndDietLevel(
      patient.operationTypeId,
      dietLevel,
    );

    if (!pod) return null;
    return this.toPodResponse(pod);
  }
}
