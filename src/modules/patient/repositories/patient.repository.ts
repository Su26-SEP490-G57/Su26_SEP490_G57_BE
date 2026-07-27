/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Role } from '../../user/entities/role.entity';
import { User } from '../../user/entities/user.entity';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { OperationType } from '../entities/operation-type.entity';
import { Patient } from '../entities/patient.entity';

/** Login account fields for the patient's linked `users` row. */
export interface PatientAccountInput {
  username?: string;
  passwordHash?: string;
  fullName?: string;
  phoneNumber?: string | null;
  cityProvince?: string | null;
  ward?: string | null;
  detailedAddress?: string | null;
  isActive?: boolean;
}

/** Clinical fields for the patient_cases row. `undefined` means "leave unchanged" on update. */
export interface PatientCaseInput {
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  weight?: number | null;
  bmi?: number | null;
  diagnosis?: string | null;
  operationTypeId?: number | null;
  method?: string | null;
  hasGiAnastomosis?: boolean | null;
  surgeryDate?: string | null;
  roomBed?: string | null;
  currentPod?: number | null;
  assignedNurseId?: number | null;
  levelId?: number | null;
}

export interface CreatePatientInput extends PatientCaseInput {
  caseId: string;
  account: PatientAccountInput & { username: string; passwordHash: string; fullName: string };
}

@Injectable()
export class PatientRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly repo: Repository<Patient>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** Build the patient query with the account / level / operation-type joins applied. */
  private baseQuery(manager?: EntityManager): SelectQueryBuilder<Patient> {
    const repo = manager ? manager.getRepository(Patient) : this.repo;
    return (
      repo
        .createQueryBuilder('patient')
        // Manual join (not a relation) → the soft-delete filter must be set explicitly.
        .leftJoinAndMapOne(
          'patient.account',
          User,
          'account',
          'account.case_id = patient.case_id AND account.deleted_at IS NULL',
        )
        .leftJoinAndSelect('account.roles', 'role')
        .leftJoinAndSelect('patient.level', 'level')
        .leftJoinAndSelect('patient.operationType', 'operationType')
        // Add subquery to get last assessment time
        .addSelect(
          (subQuery) =>
            subQuery
              .select('MAX(assessment.evaluation_datetime)')
              .from('patient_assessments', 'assessment')
              .where('assessment.case_id = patient.case_id'),
          'lastAssessmentTime',
        )
    );
  }

  findById(caseId: string): Promise<Patient | null> {
    return this.repo.findOne({ where: { caseId: caseId } });
  }

  async updateLockStatus(
    caseId: string,
    isLocked: boolean,
    holdReason: string | null,
  ): Promise<void> {
    await this.repo.update(
      { caseId: caseId },
      { isLocked: isLocked, reasonHoldPod: isLocked ? holdReason : null },
    );
  }

  async setLockedAt(caseId: string, lockedAt: Date | null): Promise<void> {
    await this.repo.update({ caseId: caseId }, { lockedAt: lockedAt });
  }

  async shiftPodStartDate(caseId: string, newPodStartDate: Date): Promise<void> {
    await this.repo.update({ caseId: caseId }, { podStartDate: newPodStartDate });
  }

  async startEras(caseId: string, startTime: Date): Promise<void> {
    await this.repo.update({ caseId: caseId }, { podStartDate: startTime, currentPod: 0 });
  }

  async updatePodLevel(caseId: string, newPodLevel: number): Promise<void> {
    await this.repo.update({ caseId: caseId }, { currentPod: newPodLevel });
  }

  /** A single patient with all relations joined (same shape as the list endpoint). */
  findByIdWithRelations(caseId: string, manager?: EntityManager): Promise<Patient | null> {
    return this.baseQuery(manager).where('patient.case_id = :caseId', { caseId }).getOne();
  }

  async findAll(query: QueryPatientDto = {}): Promise<[Patient[], number]> {
    const qb = this.baseQuery();

    // Search by case_id or patient full name
    if (query.search) {
      qb.andWhere('(patient.case_id ILIKE :search OR account.full_name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    // Filters
    if (query.level) {
      qb.andWhere('level.level_name = :level', { level: query.level });
    }
    if (query.operationTypeId !== undefined) {
      qb.andWhere('patient.operation_type_id = :operationTypeId', {
        operationTypeId: query.operationTypeId,
      });
    }

    // Sorting
    if (query.sortBy === 'pod') {
      qb.orderBy('patient.currentPod', query.sortOrder ?? 'ASC', 'NULLS LAST');
    } else {
      // Default: Red → Yellow → Green, then oldest case to the newest (by account creation)
      qb.orderBy('level.sortOrder', 'ASC', 'NULLS LAST')
        .addOrderBy('account.createdAt', 'ASC', 'NULLS LAST')
        .addOrderBy('patient.caseId', 'ASC');
    }

    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    qb.skip((page - 1) * limit).take(limit);

    // Get both raw and entity results to access the calculated lastAssessmentTime
    const rawAndEntities = await qb.getRawAndEntities();
    const total = await qb.getCount();

    // Map lastAssessmentTime from raw results to entities
    const patients = rawAndEntities.entities.map((patient, index) => {
      const rawRow = rawAndEntities.raw[index];
      (patient as Patient & { lastAssessmentTime?: Date | null }).lastAssessmentTime =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        rawRow?.patient_lastAssessmentTime || rawRow?.lastAssessmentTime || null;
      return patient;
    });

    return [patients, total];
  }

  // ── Existence / lookup helpers (for service-layer validation) ───────────────

  async caseIdExists(caseId: string): Promise<boolean> {
    // withDeleted: the case_id primary key is still occupied by soft-deleted rows.
    return (await this.repo.count({ where: { caseId: caseId }, withDeleted: true })) > 0;
  }

  findUserByUsername(username: string): Promise<User | null> {
    // withDeleted: the username unique constraint is still held by soft-deleted accounts.
    return this.dataSource.getRepository(User).findOne({ where: { username }, withDeleted: true });
  }

  async operationTypeExists(id: number): Promise<boolean> {
    return (
      (await this.dataSource
        .getRepository(OperationType)
        .count({ where: { operationTypeId: id } })) > 0
    );
  }

  async nurseExists(id: number): Promise<boolean> {
    return (await this.dataSource.getRepository(User).count({ where: { id } })) > 0;
  }

  findUserById(id: number): Promise<User | null> {
    return this.dataSource.getRepository(User).findOne({ where: { id } });
  }

  // ── Mutations (transactional, span patient_cases + users) ───────────────────

  /** Create the patient case and its linked Patient-role login account atomically. */
  async createWithAccount(input: CreatePatientInput): Promise<Patient> {
    return this.dataSource.transaction(async (manager) => {
      const role = await this.resolvePatientRole(manager);

      const user = manager.create(User, {
        username: input.account.username,
        password_hash: input.account.passwordHash,
        full_name: input.account.fullName,
        phone_number: input.account.phoneNumber ?? null,
        city_province: input.account.cityProvince ?? null,
        ward: input.account.ward ?? null,
        detailed_address: input.account.detailedAddress ?? null,
        case_id: input.caseId,
        is_active: input.account.isActive ?? true,
        roles: [role],
      });
      await manager.save(user);

      const patient = manager.create(Patient, {
        case_id: input.caseId,
        age: input.age ?? null,
        gender: input.gender ?? null,
        height: input.height ?? null,
        weight: input.weight ?? null,
        bmi: input.bmi ?? null,
        diagnosis: input.diagnosis ?? null,
        operation_type_id: input.operationTypeId ?? null,
        method: input.method ?? null,
        has_gi_anastomosis: input.hasGiAnastomosis ?? null,
        surgery_date: input.surgeryDate ?? null,
        room_bed: input.roomBed ?? null,
        current_pod: input.currentPod ?? null,
        level_id: input.levelId ?? null,
        assigned_nurse:
          input.assignedNurseId != null ? ({ id: input.assignedNurseId } as User) : null,
      });
      await manager.save(patient);

      return (await this.findByIdWithRelations(input.caseId, manager))!;
    });
  }

  /**
   * Update the patient case and its linked account. Only fields present in the
   * inputs are touched. Returns null if the case does not exist.
   */
  async updateWithAccount(
    caseId: string,
    caseFields: PatientCaseInput,
    account: PatientAccountInput,
  ): Promise<Patient | null> {
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager.findOne(Patient, { where: { caseId: caseId } });
      if (!patient) return null;

      this.applyCaseFields(patient, caseFields);
      await manager.save(patient);

      const linked = await manager.findOne(User, { where: { caseId: caseId } });
      if (linked) {
        if (account.username !== undefined) linked.username = account.username;
        if (account.fullName !== undefined) linked.fullName = account.fullName;
        if (account.phoneNumber !== undefined) linked.phoneNumber = account.phoneNumber;
        if (account.cityProvince !== undefined) linked.cityProvince = account.cityProvince;
        if (account.ward !== undefined) linked.ward = account.ward;
        if (account.detailedAddress !== undefined) linked.detailedAddress = account.detailedAddress;
        if (account.passwordHash !== undefined) linked.passwordHash = account.passwordHash;
        if (account.isActive !== undefined) linked.isActive = account.isActive;
        await manager.save(linked);
      }

      return (await this.findByIdWithRelations(caseId, manager))!;
    });
  }

  private applyCaseFields(patient: Patient, f: PatientCaseInput): void {
    if (f.age !== undefined) patient.age = f.age;
    if (f.gender !== undefined) patient.gender = f.gender;
    if (f.height !== undefined) patient.height = f.height;
    if (f.weight !== undefined) patient.weight = f.weight;
    if (f.bmi !== undefined) patient.bmi = f.bmi;
    if (f.diagnosis !== undefined) patient.diagnosis = f.diagnosis;
    if (f.operationTypeId !== undefined) patient.operationTypeId = f.operationTypeId;
    if (f.method !== undefined) patient.method = f.method;
    if (f.hasGiAnastomosis !== undefined) patient.hasGiAnastomosis = f.hasGiAnastomosis;
    if (f.surgeryDate !== undefined) patient.surgeryDate = f.surgeryDate;
    if (f.roomBed !== undefined) patient.roomBed = f.roomBed;
    if (f.currentPod !== undefined) patient.currentPod = f.currentPod;
    if (f.levelId !== undefined) patient.levelId = f.levelId;
    if (f.assignedNurseId !== undefined) {
      patient.assignedNurse =
        f.assignedNurseId != null ? ({ id: f.assignedNurseId } as User) : null;
    }
  }

  /**
   * Soft-delete a patient account (by user id) and its linked patient case
   * atomically (sets deleted_at on both rows). Clinical history is preserved.
   * The case is only touched when the account is linked to one.
   */
  async softDeletePatient(userId: number, caseId: string | null): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.softDelete(User, { id: userId });
      if (caseId) await manager.softDelete(Patient, { case_id: caseId });
    });
  }

  private async resolvePatientRole(manager: EntityManager): Promise<Role> {
    const roleRepo = manager.getRepository(Role);
    let role = await roleRepo.findOne({ where: { roleName: UserRoleName.PATIENT } });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          roleName: UserRoleName.PATIENT,
          description: 'Patient (mobile app user)',
        }),
      );
    }
    return role;
  }

  listOperationTypes(): Promise<OperationType[]> {
    return this.dataSource.getRepository(OperationType).find({ order: { operationName: 'ASC' } });
  }
}
