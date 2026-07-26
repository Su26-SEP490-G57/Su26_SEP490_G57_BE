import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PodLockDto, PodLockResponseDto } from '../dtos/pod-lock.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { LevelName } from '../entities/level.entity';
import { Patient } from '../entities/patient.entity';
import { PatientGateway } from '../gateways/patient.gateway';
import {
  PatientAccountInput,
  PatientCaseInput,
  PatientRepository,
} from '../repositories/patient.repository';

/** bcrypt cost factor — keep in sync with UsersService. */
const SALT_ROUNDS = 10;

/** Default password for an auto-provisioned patient account (changeable via PATCH /users/:id). */
const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

export interface CurrentPodResponse {
  caseId: string;
  currentPod: number | null;
  isLocked: boolean;
  holdReason: string | null;
}

export interface PatientAccount {
  id: number;
  username: string;

  fullName: string;
  phoneNumber: string | null;
  cityProvince: string | null;
  ward: string | null;
  detailedAddress: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
}

export interface PatientLevel {
  id: number;
  name: LevelName;
  description: string | null;
}

export interface PatientOperationType {
  id: number;
  name: string;
}

export type PatientWithAccount = Omit<Patient, 'account' | 'level' | 'operationType'> & {
  account: PatientAccount | null;
  level: PatientLevel | null;
  operationType: PatientOperationType | null;
  lastAssessmentTime?: Date | null;
  full_name?: string | null;
};

export interface PaginatedPatients {
  data: PatientWithAccount[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PatientService {
  constructor(
    private readonly repository: PatientRepository,
    private readonly patientGateway: PatientGateway,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private toResponse({
    account,
    level,
    operationType,
    ...patient
  }: Patient & { lastAssessmentTime?: Date | null }): PatientWithAccount {
    return {
      ...patient,
      account: account
        ? {
            id: account.id,
            username: account.username,
            fullName: account.fullName,
            phoneNumber: account.phoneNumber,
            cityProvince: account.cityProvince,
            ward: account.ward,
            detailedAddress: account.detailedAddress,
            isActive: account.isActive,
            roles: (account.roles ?? []).map((r) => r.roleName),
            createdAt: account.createdAt,
          }
        : null,
      level: level
        ? {
            id: level.levelId,
            name: level.levelName,
            description: level.description,
          }
        : null,
      operationType: operationType
        ? {
            id: operationType.operationTypeId,
            name: operationType.operationName,
          }
        : null,
      lastAssessmentTime: patient.lastAssessmentTime ?? null,
      // Add full_name from account for convenience
      full_name: account?.fullName ?? null,
    };
  }

  async getAllPatients(query: QueryPatientDto = {}): Promise<PaginatedPatients> {
    const [patients, total] = await this.repository.findAll(query);
    return {
      data: patients.map((p) => this.toResponse(p)),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };
  }

  /**
   * Get the maximum POD level for a given operation type based on pod_protocols table.
   * Returns the count of POD protocols - 1 (since POD starts from 0).
   * Returns null if no protocols found for the operation type.
   */
  async getMaxPodForOperationType(operationTypeId: number): Promise<number | null> {
    const result = await this.dataSource.query<Array<{ count: string }>>(
      `
      SELECT COUNT(*) as count
      FROM pod_protocols
      WHERE operation_type_id = $1
    `,
      [operationTypeId],
    );

    const count = parseInt(result[0]?.count ?? '0', 10);
    return count > 0 ? count - 1 : null;
  }

  async getCurrentPod(caseId: string): Promise<CurrentPodResponse> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    return {
      caseId: patient.caseId,
      currentPod: patient.currentPod,
      isLocked: patient.isLocked,
      holdReason: patient.reasonHoldPod,
    };
  }

  async startEras(
    caseId: string,
  ): Promise<{ caseId: string; currentPod: number; podStartDate: Date }> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    if (patient.podStartDate) {
      throw new BadRequestException(`ERAS already started for patient ${caseId}`);
    }

    const now = new Date();
    await this.repository.updateLockStatus(caseId, false, null);
    await this.repository.startEras(caseId, now);

    return { caseId, currentPod: 0, podStartDate: now };
  }

  async lockPod(caseId: string, dto: PodLockDto): Promise<PodLockResponseDto> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    if (patient.currentPod === null) {
      throw new BadRequestException(`Patient ${caseId} has no active POD`);
    }
    if (dto.isLocked && !dto.holdReason) {
      throw new BadRequestException('holdReason is required when locking POD');
    }

    const now = new Date();

    if (dto.isLocked) {
      // Lock: record hold reason + timestamp when lock started
      await this.repository.updateLockStatus(caseId, true, dto.holdReason ?? null);
      await this.repository.setLockedAt(caseId, now);
    } else {
      // Unlock: shift pod_start_date forward by lock duration so POD stays the same
      if (patient.lockedAt && patient.podStartDate) {
        const lockDurationMs = now.getTime() - new Date(patient.lockedAt).getTime();
        const newPodStartDate = new Date(new Date(patient.podStartDate).getTime() + lockDurationMs);
        await this.repository.shiftPodStartDate(caseId, newPodStartDate);
      }
      await this.repository.updateLockStatus(caseId, false, null);
      await this.repository.setLockedAt(caseId, null);
    }

    const response: PodLockResponseDto = {
      caseId,
      currentPod: patient.currentPod,
      isLocked: dto.isLocked,
      holdReason: dto.isLocked ? (dto.holdReason ?? null) : null,
    };

    if (dto.isLocked) {
      this.patientGateway.emitPodLocked(response);
    } else {
      this.patientGateway.emitPodUnlocked(response);
    }

    return response;
  }

  /**
   * Manually adjust POD level for a patient (rollback only).
   * The new POD level must be >= 0 and < current_pod.
   * If rolling back from completed status, reset erasCompleted to false.
   */
  async updatePodLevel(caseId: string, newPodLevel: number): Promise<PatientWithAccount> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    if (patient.currentPod === null) {
      throw new BadRequestException(`Patient ${caseId} has no active POD`);
    }

    if (newPodLevel < 0) {
      throw new BadRequestException('POD level must be >= 0');
    }

    if (newPodLevel >= patient.currentPod) {
      throw new BadRequestException(
        `POD level must be < current POD (${patient.currentPod}). Only rollback is allowed.`,
      );
    }

    // Get max POD for the operation type
    const maxPod = await this.getMaxPodForOperationType(patient.operationTypeId!);

    // Update POD level
    await this.repository.updatePodLevel(caseId, newPodLevel);

    // If rolling back from max POD (completed status), reset erasCompleted to false
    if (patient.erasCompleted && maxPod !== null && newPodLevel < maxPod) {
      await this.dataSource
        .getRepository(Patient)
        .update({ caseId: caseId }, { erasCompleted: false });
    }

    const updated = await this.repository.findByIdWithRelations(caseId);
    if (!updated) throw new NotFoundException(`Patient ${caseId} not found after update`);

    return this.toResponse(updated);
  }

  /** Operation types for the surgery-type dropdown. */
  async getOperationTypes(): Promise<PatientOperationType[]> {
    const types = await this.repository.listOperationTypes();
    return types.map((t) => ({ id: t.operationTypeId, name: t.operationName }));
  }

  /**
   * Create a patient: the clinical `patient_cases` row plus the linked
   * Patient-role login account (users.case_id = patient_cases.case_id).
   */
  async createPatient(dto: CreatePatientDto): Promise<PatientWithAccount> {
    if (await this.repository.caseIdExists(dto.caseId)) {
      throw new ConflictException(`Patient case "${dto.caseId}" already exists`);
    }

    const username = dto.username ?? dto.caseId;
    if (await this.repository.findUserByUsername(username)) {
      throw new ConflictException(`Username "${username}" is already taken`);
    }

    await this.assertReferencesExist(dto.operationTypeId, dto.assignedNurseId);

    const passwordHash = await bcrypt.hash(dto.password ?? DEFAULT_PATIENT_PASSWORD, SALT_ROUNDS);

    const created = await this.repository.createWithAccount({
      caseId: dto.caseId,
      ...this.toCaseFields(dto),
      currentPod: dto.currentPod ?? 0,
      account: {
        username,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber ?? null,
        cityProvince: dto.cityProvince ?? null,
        ward: dto.ward ?? null,
        detailedAddress: dto.detailedAddress ?? null,
      },
    });

    return this.toResponse(created);
  }

  /** Update a patient case and its linked login account, addressed by the account's user id. */
  async updatePatient(userId: number, dto: UpdatePatientDto): Promise<PatientWithAccount> {
    const user = await this.repository.findUserById(userId);
    if (!user || !user.caseId) throw new NotFoundException(`Patient user #${userId} not found`);
    const caseId = user.caseId;

    const existing = await this.repository.findById(caseId);
    if (!existing) throw new NotFoundException(`Patient ${caseId} not found`);

    if (dto.username !== undefined) {
      const owner = await this.repository.findUserByUsername(dto.username);
      if (owner && owner.caseId !== caseId) {
        throw new ConflictException(`Username "${dto.username}" is already taken`);
      }
    }

    await this.assertReferencesExist(dto.operationTypeId, dto.assignedNurseId);

    const account: PatientAccountInput = {
      username: dto.username,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      cityProvince: dto.cityProvince,
      ward: dto.ward,
      detailedAddress: dto.detailedAddress,
      isActive: dto.isActive,
    };
    if (dto.password !== undefined) {
      account.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const updated = await this.repository.updateWithAccount(
      caseId,
      this.toCaseFields(dto),
      account,
    );
    if (!updated) throw new NotFoundException(`Patient ${caseId} not found`);

    return this.toResponse(updated);
  }

  /**
   * Soft-delete a patient by the account's user id: marks both the linked
   * login account and its patient_cases row as deleted (deleted_at). Clinical
   * history is preserved.
   */
  async deletePatient(
    userId: number,
  ): Promise<{ userId: number; caseId: string | null; deleted: true }> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    await this.repository.softDeletePatient(user.id, user.caseId);
    return { userId: user.id, caseId: user.caseId, deleted: true };
  }

  /** Validate optional foreign keys before a write. */
  private async assertReferencesExist(
    operationTypeId?: number,
    assignedNurseId?: number,
  ): Promise<void> {
    if (operationTypeId != null && !(await this.repository.operationTypeExists(operationTypeId))) {
      throw new BadRequestException(`Operation type ${operationTypeId} does not exist`);
    }
    if (assignedNurseId != null && !(await this.repository.nurseExists(assignedNurseId))) {
      throw new BadRequestException(`Assigned nurse ${assignedNurseId} does not exist`);
    }
  }

  /** Map the (camelCase) DTO clinical fields to the repository's case-field shape. */
  private toCaseFields(dto: CreatePatientDto | UpdatePatientDto): PatientCaseInput {
    return {
      age: dto.age,
      gender: dto.gender,
      height: dto.height,
      weight: dto.weight,
      bmi: dto.bmi,
      diagnosis: dto.diagnosis,
      operationTypeId: dto.operationTypeId,
      method: dto.method,
      hasGiAnastomosis: dto.hasGiAnastomosis,
      surgeryDate: dto.surgeryDate,
      roomBed: dto.roomBed,
      currentPod: dto.currentPod,
      assignedNurseId: dto.assignedNurseId,
      levelId: dto.levelId,
    };
  }
}
