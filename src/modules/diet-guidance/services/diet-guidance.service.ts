import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
import {
  CustomDietGuidanceResponseDto,
  PatientCurrentDietGuidanceResponseDto,
  UpsertCustomDietGuidanceDto,
} from '../dtos/custom-diet-guidance.dto';
import { CustomDietGuidance } from '../entities/custom-diet-guidance.entity';
import { PodProtocol } from '../entities/pod-protocol.entity';
import { DietGuidanceRepository } from '../repositories/diet-guidance.repository';

@Injectable()
export class DietGuidanceService {
  private readonly logger = new Logger(DietGuidanceService.name);

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

  private toCustomDietResponse(custom: CustomDietGuidance): CustomDietGuidanceResponseDto {
    return {
      customDietId: custom.customDietId,
      caseId: custom.caseId,
      doctorId: custom.doctorId,
      doctor: custom.doctor
        ? {
            id: custom.doctor.id,
            fullName: custom.doctor.fullName,
          }
        : undefined,
      isActive: custom.isActive,
      label: custom.label,
      mealsPerDayMin: custom.mealsPerDayMin,
      mealsPerDayMax: custom.mealsPerDayMax,
      mealInstruction: custom.mealInstruction,
      volumePerMealMin: custom.volumePerMealMin,
      volumePerMealMax: custom.volumePerMealMax,
      volumeInstruction: custom.volumeInstruction,
      recommendedFoods: custom.recommendedFoods ?? [],
      recommendedDrinks: custom.recommendedDrinks ?? [],
      forbiddenFoods: custom.forbiddenFoods ?? [],
      forbiddenDrinks: custom.forbiddenDrinks ?? [],
      doctorNotes: custom.doctorNotes,
      updatedAt: custom.updatedAt,
      createdAt: custom.createdAt,
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

    const patientCount = await this.repository.countPatientsByDietLevel(
      operationTypeId,
      pod.dietLevel,
    );
    if (patientCount > 0) {
      throw new ConflictException(
        `Cannot delete diet level protocol. ${patientCount} active patient(s) are currently at this diet level.`,
      );
    }

    await this.repository.deletePod(podId);
  }

  // ── Personalized (Custom) Diet Guidance ────────────────────────────────────

  async getCustomDietGuidance(caseId: string): Promise<CustomDietGuidanceResponseDto | null> {
    const custom = await this.repository.findCustomDietByCaseId(caseId);
    if (!custom) return null;
    return this.toCustomDietResponse(custom);
  }

  async upsertCustomDietGuidance(
    caseId: string,
    dto: UpsertCustomDietGuidanceDto,
    doctorId: number,
  ): Promise<CustomDietGuidanceResponseDto> {
    this.logger.log(`Doctor #${doctorId} updating custom diet guidance for case "${caseId}"`, {
      caseId,
      doctorId,
      dto,
    });

    const patient = await this.repository.findPatientByCaseId(caseId);
    if (!patient) {
      this.logger.warn(`Failed to update custom diet guidance: Patient case "${caseId}" not found`);
      throw new NotFoundException(`Patient case "${caseId}" not found`);
    }

    let custom = await this.repository.findCustomDietByCaseId(caseId);
    const isNew = !custom;

    if (!custom) {
      custom = new CustomDietGuidance();
      custom.caseId = caseId;
      custom.doctorId = doctorId;
      custom.isActive = dto.isActive ?? true;
      custom.label = dto.label ?? 'Chế độ ăn chỉ định riêng';
    } else {
      custom.doctorId = doctorId; // Cập nhật bác sĩ chỉ định gần nhất
      if (dto.isActive !== undefined) custom.isActive = dto.isActive;
      if (dto.label !== undefined) custom.label = dto.label;
    }

    if (dto.mealsPerDayMin !== undefined) custom.mealsPerDayMin = dto.mealsPerDayMin ?? null;
    if (dto.mealsPerDayMax !== undefined) custom.mealsPerDayMax = dto.mealsPerDayMax ?? null;
    if (dto.mealInstruction !== undefined) custom.mealInstruction = dto.mealInstruction ?? null;
    if (dto.volumePerMealMin !== undefined) custom.volumePerMealMin = dto.volumePerMealMin ?? null;
    if (dto.volumePerMealMax !== undefined) custom.volumePerMealMax = dto.volumePerMealMax ?? null;
    if (dto.volumeInstruction !== undefined)
      custom.volumeInstruction = dto.volumeInstruction ?? null;
    if (dto.recommendedFoods !== undefined) custom.recommendedFoods = dto.recommendedFoods;
    if (dto.recommendedDrinks !== undefined) custom.recommendedDrinks = dto.recommendedDrinks;
    if (dto.forbiddenFoods !== undefined) custom.forbiddenFoods = dto.forbiddenFoods;
    if (dto.forbiddenDrinks !== undefined) custom.forbiddenDrinks = dto.forbiddenDrinks;
    if (dto.doctorNotes !== undefined) custom.doctorNotes = dto.doctorNotes ?? null;

    const saved = await this.repository.saveCustomDiet(custom);
    this.logger.log(
      `Custom diet guidance successfully ${isNew ? 'created' : 'updated'} for case "${caseId}" (customDietId: ${saved.customDietId}, isActive: ${saved.isActive})`,
    );

    // Re-fetch to load doctor relation
    const reloaded = await this.repository.findCustomDietByCaseId(caseId);
    return this.toCustomDietResponse(reloaded ?? saved);
  }

  async toggleCustomDietStatus(
    caseId: string,
    isActive: boolean,
    doctorId: number,
  ): Promise<CustomDietGuidanceResponseDto> {
    this.logger.log(
      `Doctor #${doctorId} toggling custom diet status for case "${caseId}" to isActive=${isActive}`,
    );

    const custom = await this.repository.findCustomDietByCaseId(caseId);
    if (!custom) {
      throw new NotFoundException(`Custom diet guidance not found for case "${caseId}"`);
    }

    custom.isActive = isActive;
    custom.doctorId = doctorId;
    const saved = await this.repository.saveCustomDiet(custom);

    this.logger.log(
      `Custom diet guidance status toggled for case "${caseId}": isActive=${saved.isActive}`,
    );

    const reloaded = await this.repository.findCustomDietByCaseId(caseId);
    return this.toCustomDietResponse(reloaded ?? saved);
  }

  // ── Patient Diet Guidance (Resolved: Custom or Standard) ────────────────────

  async getCurrentDietGuidanceForPatient(
    caseId: string,
  ): Promise<PatientCurrentDietGuidanceResponseDto | null> {
    this.logger.debug(`Fetching current diet guidance for patient case "${caseId}"`);

    const patient = await this.repository.findPatientByCaseId(caseId);
    if (!patient) {
      this.logger.warn(`Patient case "${caseId}" not found when fetching diet guidance`);
      return null;
    }

    // 1. Kiểm tra xem có Hướng dẫn ăn riêng do Bác sĩ chỉ định và đang active không
    const activeCustomDiet = await this.repository.findActiveCustomDietByCaseId(caseId);
    if (activeCustomDiet) {
      this.logger.log(
        `Case "${caseId}" has active custom diet guidance (ID: ${activeCustomDiet.customDietId}, Doctor: ${activeCustomDiet.doctorId})`,
      );

      return {
        isCustomized: true,
        customDietId: activeCustomDiet.customDietId,
        label: activeCustomDiet.label,
        dietLevel: patient.currentDietLevel ?? 0,
        mealsPerDayMin: activeCustomDiet.mealsPerDayMin,
        mealsPerDayMax: activeCustomDiet.mealsPerDayMax,
        mealInstruction: activeCustomDiet.mealInstruction,
        volumePerMealMin: activeCustomDiet.volumePerMealMin,
        volumePerMealMax: activeCustomDiet.volumePerMealMax,
        volumeInstruction: activeCustomDiet.volumeInstruction,
        recommendedFoods: activeCustomDiet.recommendedFoods ?? [],
        recommendedDrinks: activeCustomDiet.recommendedDrinks ?? [],
        forbiddenFoods: activeCustomDiet.forbiddenFoods ?? [],
        forbiddenDrinks: activeCustomDiet.forbiddenDrinks ?? [],
        doctorNotes: activeCustomDiet.doctorNotes,
        prescribedByDoctor: activeCustomDiet.doctor
          ? {
              id: activeCustomDiet.doctor.id,
              fullName: activeCustomDiet.doctor.fullName,
            }
          : undefined,
        updatedAt: activeCustomDiet.updatedAt,
      };
    }

    // 2. Nếu không có chỉ định riêng hoặc đang unactive, dùng hướng dẫn chung theo POD protocol
    if (patient.operationTypeId === null || patient.operationTypeId === undefined) {
      this.logger.debug(`Case "${caseId}" does not have an operationTypeId assigned`);
      return null;
    }

    const dietLevel = patient.currentDietLevel ?? 0;
    const pod = await this.repository.findPodByOperationAndDietLevel(
      patient.operationTypeId,
      dietLevel,
    );

    if (!pod) {
      this.logger.debug(
        `No PodProtocol found for opType ${patient.operationTypeId} at dietLevel ${dietLevel}`,
      );
      return null;
    }

    return {
      isCustomized: false,
      podId: pod.podId,
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
    };
  }
}
