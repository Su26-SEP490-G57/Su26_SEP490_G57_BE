import { Injectable, NotFoundException } from '@nestjs/common';
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

export type PatientWithAccount = Omit<Patient, 'account'> & {
  account: PatientAccount | null;
};

@Injectable()
export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

  async getAllPatients(): Promise<PatientWithAccount[]> {
    const patients = await this.repository.getAllPatients();
    return patients.map(({ account, ...patient }) => ({
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
    }));
  }

  async getCurrentPod(caseId: string): Promise<CurrentPodResponse> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    return { caseId: patient.case_id, currentPod: patient.current_pod };
  }
}
