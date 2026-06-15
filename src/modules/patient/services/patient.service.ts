import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientRepository } from '../repositories/patient.repository';

export interface CurrentPodResponse {
  caseId: string;
  currentPod: number | null;
}

@Injectable()
export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

  async getCurrentPod(caseId: string): Promise<CurrentPodResponse> {
    const patient = await this.repository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);
    return { caseId: patient.case_id, currentPod: patient.current_pod };
  }
}
