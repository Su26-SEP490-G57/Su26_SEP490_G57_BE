import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class PatientRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly repo: Repository<Patient>,
  ) {}

  findById(caseId: string): Promise<Patient | null> {
    return this.repo.findOne({ where: { case_id: caseId } });
  }
  getAllPatients(): Promise<Patient[]> {
    return this.repo
      .createQueryBuilder('patient')
      .leftJoinAndMapOne(
        'patient.account',
        User,
        'account',
        'account.case_id = patient.case_id',
      )
      .leftJoinAndSelect('account.roles', 'role')
      .getMany();
  }
}
