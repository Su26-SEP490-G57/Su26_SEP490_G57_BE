import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { LevelName } from '../entities/level.entity';
import { Patient } from '../entities/patient.entity';
import { PatientRepository } from '../repositories/patient.repository';

export interface CurrentPodResponse {
  caseId: string;
  currentPod: number | null;
}

export interface PatientAccount {
  id: number;
  username: string;
  fullName: string;
  phoneNumber: string | null;
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
  constructor(private readonly repository: PatientRepository) {}

  private toResponse({ account, level, operationType, ...patient }: Patient): PatientWithAccount {
    return {
      ...patient,
      account: account
        ? {
            id: account.id,
            username: account.username,
            fullName: account.full_name,
            phoneNumber: account.phone_number,
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
}
