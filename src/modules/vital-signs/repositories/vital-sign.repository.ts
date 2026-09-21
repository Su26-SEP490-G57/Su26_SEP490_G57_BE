import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { VitalSign } from '../entities/vital-sign.entity';

@Injectable()
export class VitalSignRepository {
  constructor(
    @InjectRepository(VitalSign)
    private readonly repo: Repository<VitalSign>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  async patientExists(caseId: string): Promise<boolean> {
    return (await this.patientRepo.count({ where: { caseId } })) > 0;
  }

  save(data: DeepPartial<VitalSign>): Promise<VitalSign> {
    return this.repo.save(data);
  }

  /** Newest first, paginated. */
  findByCaseId(caseId: string, page: number, limit: number): Promise<[VitalSign[], number]> {
    return this.repo.findAndCount({
      where: { caseId },
      order: { recordedAt: 'DESC', vitalSignId: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
