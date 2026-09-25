import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Levels } from '../constants/levels.constant';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PodLockDto, PodLockResponseDto } from '../dtos/pod-lock.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { Patient } from '../entities/patient.entity';
import { PodProtocol } from '../../diet-guidance/entities/pod-protocol.entity';
import { AutoCompleteService } from '../../diet-guidance/services/auto-complete.service';
import { PatientGateway } from '../gateways/patient.gateway';
import { VitalSign } from '../../vital-signs/entities/vital-sign.entity';
import { PodProtocolTrackingLog } from '../entities/pod-protocol-tracking-log.entity';
import { User } from '../../user/entities/user.entity';
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

export interface PatientActivityLogItem {
  logId: string;
  caseId: string;
  patientName: string;
  roomBed: string;
  nurseName: string;
  actorName: string;
  recordedAt: string;
  createdAt: string;
  type: 'VITAL_SIGNS' | 'NURSE_PAUSE';
  actionType: string;
  vitalSignId?: number;
  pulseBpm?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperatureCelsius?: number;
  respiratoryRate?: number;
  spo2Percent?: number;
  note?: string | null;
  holdReason?: string | null;
  reason?: string | null;
  changedAt?: string;
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
  name: string;
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
    @InjectRepository(PodProtocol)
    private readonly podRepo: Repository<PodProtocol>,
    private readonly autoCompleteService: AutoCompleteService,
  ) {}

  calculateDynamicPod(patient: Patient, maxPod?: number | null): number {
    if (patient.currentPod === null || patient.currentPod === undefined) {
      return 0;
    }
    // POD hiện tại chính là POD đã lưu (được quản lý bởi Scheduler), không tự tính toán theo thời gian thực
    const pod = patient.currentPod;
    if (maxPod !== undefined && maxPod !== null) {
      return Math.min(pod, maxPod);
    }
    return pod;
  }

  private toResponse(
    fullPatient: Patient & { lastAssessmentTime?: Date | null },
  ): PatientWithAccount {
    const { account, level, operationType, ...patient } = fullPatient;
    const dynamicPod = this.calculateDynamicPod(fullPatient);
    return {
      ...patient,
      currentPod: dynamicPod,
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

  async getPatientByCaseId(caseId: string): Promise<PatientWithAccount> {
    const patient = await this.repository.findByIdWithRelations(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    return this.toResponse(patient);
  }

  /**
   * Get the maximum POD level for a given operation type based on pod_protocols table.
   * Returns the count of POD protocols - 1 (since POD starts from 0).
   * Returns null if no protocols found for the operation type.
   */
  async getMaxPodForOperationType(operationTypeId: number): Promise<number | null> {
    const count = await this.dataSource.getRepository(PodProtocol).countBy({ operationTypeId });

    return count > 0 ? count - 1 : null;
  }

  /**
   * Get the maximum diet level for a patient's operation type.
   * Returns the highest dietLevel from pod_protocols for that operation type.
   */
  async getMaxDietLevelForPatient(patient: Patient): Promise<number> {
    if (!patient.operationTypeId) return 0;

    const protocols = await this.podRepo.find({
      where: { operationTypeId: patient.operationTypeId },
    });

    if (protocols.length === 0) return 0;

    return Math.max(...protocols.map((p) => p.dietLevel));
  }

  async getCurrentPod(caseId: string): Promise<CurrentPodResponse> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const maxPod = patient.operationTypeId
      ? await this.getMaxPodForOperationType(patient.operationTypeId)
      : null;
    const dynamicPod = this.calculateDynamicPod(patient, maxPod);

    return {
      caseId: patient.caseId,
      currentPod: dynamicPod,
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

  async lockPod(
    caseId: string,
    dto: PodLockDto,
    changedById: number | null = null,
  ): Promise<PodLockResponseDto> {
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

    // Analytics: record the hold/resume transition for the recovery-matrix dashboard.
    await this.repository.recordPodTrackingLog({
      caseId,
      podNumber: patient.currentPod,
      oldStatus: dto.isLocked ? 'Active' : 'Paused',
      newStatus: dto.isLocked ? 'Paused' : 'Active',
      actionType: dto.isLocked ? 'Nurse_Pause' : 'Nurse_Resume',
      changedById,
      holdReason: dto.isLocked ? (dto.holdReason ?? null) : null,
    });

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

  async updateDietLevel(
    caseId: string,
    newDietLevel: number,
    changedById: number | null = null,
    reason?: string | null,
    canIncrease = false,
  ): Promise<PatientWithAccount> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const maxDietLevel = await this.getMaxDietLevelForPatient(patient);
    if (newDietLevel < 0 || newDietLevel > maxDietLevel) {
      throw new BadRequestException(`Diet level must be between 0 and ${maxDietLevel}`);
    }

    const previousLevel = patient.currentDietLevel ?? 0;
    if (newDietLevel > previousLevel && !canIncrease) {
      throw new ForbiddenException(
        'Chỉ bác sĩ mới có thể tăng mức độ ăn uống. Điều dưỡng chỉ được phép hạ mức độ hoặc giữ nguyên.',
      );
    }

    // Cancel auto-complete if diet level decreased from max
    if (newDietLevel < previousLevel && previousLevel === maxDietLevel) {
      await this.autoCompleteService.cancelCompletion(caseId);
    }

    const updatePayload: Partial<Patient> = { currentDietLevel: newDietLevel };
    if (newDietLevel === maxDietLevel && patient.podSoftDietReached === null) {
      updatePayload.podSoftDietReached = patient.currentPod;
    }

    await this.dataSource.getRepository(Patient).update({ caseId }, updatePayload);

    // Audit log
    await this.repository.recordPodTrackingLog({
      caseId,
      podNumber: patient.currentPod,
      oldStatus: `Mức ăn ${previousLevel}`,
      newStatus: `Mức ăn ${newDietLevel}`,
      actionType: 'Nurse_Acknowledge',
      changedById,
      holdReason:
        reason ?? `Điều dưỡng/Bác sĩ cập nhật mức ăn: Mức ${previousLevel} -> Mức ${newDietLevel}`,
    });

    const updated = await this.repository.findById(caseId);
    return this.toResponse(updated!);
  }

  /**
   * Manually adjust POD level for a patient (rollback only).
   * The new POD level must be >= 0 and < current_pod.
   * If rolling back from completed status, reset erasCompleted to false.
   */
  async updatePodLevel(
    caseId: string,
    newPodLevel: number,
    changedById: number | null = null,
  ): Promise<PatientWithAccount> {
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

    const previousPod = patient.currentPod;

    // Update POD level
    await this.repository.updatePodLevel(caseId, newPodLevel);

    // Rebase pod_start_date to the new level so the dynamic POD calculation
    // (elapsed days since pod_start_date) doesn't immediately recompute back
    // toward the pre-rollback value on the very next read.
    if (patient.podStartDate) {
      const newPodStartDate = new Date(Date.now() - newPodLevel * 24 * 60 * 60 * 1000);
      await this.repository.shiftPodStartDate(caseId, newPodStartDate);
    }

    // If rolling back from max POD (completed status), reset erasCompleted to false
    if (patient.erasCompleted && maxPod !== null && newPodLevel < maxPod) {
      await this.dataSource
        .getRepository(Patient)
        .update({ caseId: caseId }, { erasCompleted: false });
    }

    // Analytics: record the rollback for the recovery-matrix dashboard.
    await this.repository.recordPodTrackingLog({
      caseId,
      podNumber: newPodLevel,
      oldStatus: `POD ${previousPod}`,
      newStatus: `POD ${newPodLevel}`,
      actionType: 'Nurse_Rollback',
      changedById,
    });

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
    // Manual "Thêm mới" omits caseId -> auto-generate the next "CASE-NNN".
    // The HIS import flow always passes its own hospital code explicitly.
    const caseId = dto.caseId ?? (await this.repository.generateNextCaseId());
    if (dto.caseId && (await this.repository.caseIdExists(caseId))) {
      throw new ConflictException(`Patient case "${caseId}" already exists`);
    }

    const username = dto.username ?? caseId;
    if (await this.repository.findUserByUsername(username)) {
      throw new ConflictException(`Username "${username}" is already taken`);
    }

    await this.assertReferencesExist(dto.operationTypeId, dto.assignedNurseId);

    const passwordHash = await bcrypt.hash(dto.password ?? DEFAULT_PATIENT_PASSWORD, SALT_ROUNDS);

    // Compute BMI if weight/height are valid
    let bmi: number | null = null;
    if (dto.weight && dto.height && dto.height > 0) {
      bmi = parseFloat((dto.weight / (dto.height / 100) ** 2).toFixed(1));
    }

    const created = await this.repository.createWithAccount({
      caseId,
      // Default to Green (stable) until a real assessment reclassifies the
      // patient — otherwise the board has nowhere to show an unassessed
      // patient at all (its risk-level columns key off level).
      ...this.toCaseFields({
        ...dto,
        bmi: dto.bmi ?? bmi,
        levelId: dto.levelId ?? Levels.GREEN.levelId,
      }),
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
      comorbidities: dto.comorbidities,
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

  async getNursePauseLogs(
    page = 1,
    limit = 100,
  ): Promise<{
    data: PatientActivityLogItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const vitalSignsRepo = this.dataSource.getRepository(VitalSign);
    const trackingLogRepo = this.dataSource.getRepository(PodProtocolTrackingLog);
    const userRepo = this.dataSource.getRepository(User);

    const [vitals, vitalTotal] = await vitalSignsRepo.findAndCount({
      order: { recordedAt: 'DESC', vitalSignId: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const [trackingLogs, trackingTotal] = await trackingLogRepo.findAndCount({
      order: { changedAt: 'DESC', logId: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const caseIds = Array.from(
      new Set([...vitals.map((v) => v.caseId), ...trackingLogs.map((t) => t.caseId)]),
    );

    const userIds = Array.from(
      new Set([
        ...vitals.map((v) => v.recordedByUserId).filter((id): id is number => id != null),
        ...trackingLogs.map((t) => t.changedById).filter((id): id is number => id != null),
      ]),
    );

    const patientMap = new Map<string, { name: string; room: string }>();
    if (caseIds.length > 0) {
      for (const cId of caseIds) {
        const p = await this.repository.findByIdWithRelations(cId);
        if (p) {
          patientMap.set(cId, {
            name: p.account?.fullName ?? cId,
            room: p.roomBed ?? '',
          });
        }
      }
    }

    const userMap = new Map<number, string>();
    if (userIds.length > 0) {
      for (const uId of userIds) {
        const u = await userRepo.findOne({ where: { id: uId } });
        if (u) {
          userMap.set(uId, u.fullName);
        }
      }
    }

    const items: PatientActivityLogItem[] = [];

    for (const v of vitals) {
      const pInfo = patientMap.get(v.caseId);
      items.push({
        logId: `vital-${v.vitalSignId}`,
        vitalSignId: v.vitalSignId,
        caseId: v.caseId,
        patientName: pInfo?.name ?? v.caseId,
        roomBed: pInfo?.room ?? '',
        pulseBpm: v.pulseBpm,
        bloodPressureSystolic: v.bloodPressureSystolic,
        bloodPressureDiastolic: v.bloodPressureDiastolic,
        temperatureCelsius: Number(v.temperatureCelsius),
        respiratoryRate: v.respiratoryRate,
        spo2Percent: v.spo2Percent,
        note: v.note ?? null,
        nurseName:
          v.recordedByName ||
          (v.recordedByUserId ? userMap.get(v.recordedByUserId) : 'Điều dưỡng') ||
          'Điều dưỡng',
        actorName:
          v.recordedByName ||
          (v.recordedByUserId ? userMap.get(v.recordedByUserId) : 'Điều dưỡng') ||
          'Điều dưỡng',
        recordedAt: v.recordedAt.toISOString(),
        createdAt: v.recordedAt.toISOString(),
        type: 'VITAL_SIGNS',
        actionType: 'VITAL_SIGNS',
      });
    }

    for (const t of trackingLogs) {
      const pInfo = patientMap.get(t.caseId);
      items.push({
        logId: `pause-${t.logId}`,
        caseId: t.caseId,
        patientName: pInfo?.name ?? t.caseId,
        roomBed: pInfo?.room ?? '',
        holdReason: t.holdReason ?? null,
        reason: t.holdReason ?? null,
        nurseName: t.changedById ? (userMap.get(t.changedById) ?? 'Điều dưỡng') : 'Điều dưỡng',
        actorName: t.changedById ? (userMap.get(t.changedById) ?? 'Điều dưỡng') : 'Điều dưỡng',
        recordedAt: t.changedAt.toISOString(),
        createdAt: t.changedAt.toISOString(),
        changedAt: t.changedAt.toISOString(),
        type: 'NURSE_PAUSE',
        actionType: t.actionType ?? 'MANUAL_HOLD',
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paginated = items.slice(0, limit);

    return {
      data: paginated,
      total: vitalTotal + trackingTotal,
      page,
      limit,
    };
  }
}
