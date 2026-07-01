import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  ) {}

  private toResponse({ account, level, operationType, ...patient }: Patient): PatientWithAccount {
    return {
      ...patient,
      account: account
        ? {
            id: account.id,
            username: account.username,
            fullName: account.full_name,
            phoneNumber: account.phone_number,
            cityProvince: account.city_province,
            ward: account.ward,
            detailedAddress: account.detailed_address,
            isActive: account.is_active,
            roles: (account.roles ?? []).map((r) => r.roleName),
            createdAt: account.created_at,
          }
        : null,
      level: level
        ? {
            id: level.level_id,
            name: level.level_name,
            description: level.description,
          }
        : null,
      operationType: operationType
        ? {
            id: operationType.operation_type_id,
            name: operationType.operation_name,
          }
        : null,
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

  async getCurrentPod(caseId: string): Promise<CurrentPodResponse> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    return { caseId: patient.case_id, currentPod: patient.current_pod };
  }

  async startEras(caseId: string): Promise<{ caseId: string; currentPod: number; podStartDate: Date }> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    if (patient.pod_start_date) {
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
    if (patient.current_pod === null) {
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
      if (patient.locked_at && patient.pod_start_date) {
        const lockDurationMs = now.getTime() - new Date(patient.locked_at).getTime();
        const newPodStartDate = new Date(new Date(patient.pod_start_date).getTime() + lockDurationMs);
        await this.repository.shiftPodStartDate(caseId, newPodStartDate);
      }
      await this.repository.updateLockStatus(caseId, false, null);
      await this.repository.setLockedAt(caseId, null);
    }

    const response: PodLockResponseDto = {
      caseId,
      currentPod: patient.current_pod,
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

  /** Operation types for the surgery-type dropdown. */
  async getOperationTypes(): Promise<PatientOperationType[]> {
    const types = await this.repository.listOperationTypes();
    return types.map((t) => ({ id: t.operation_type_id, name: t.operation_name }));
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
    if (!user || !user.case_id) throw new NotFoundException(`Patient user #${userId} not found`);
    const caseId = user.case_id;

    const existing = await this.repository.findById(caseId);
    if (!existing) throw new NotFoundException(`Patient ${caseId} not found`);

    if (dto.username !== undefined) {
      const owner = await this.repository.findUserByUsername(dto.username);
      if (owner && owner.case_id !== caseId) {
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

    const updated = await this.repository.updateWithAccount(caseId, this.toCaseFields(dto), account);
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

    await this.repository.softDeletePatient(user.id, user.case_id);
    return { userId: user.id, caseId: user.case_id, deleted: true };
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
      nameInitials: dto.nameInitials,
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
