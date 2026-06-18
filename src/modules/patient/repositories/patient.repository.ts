import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QueryPatientDto } from '../dtos/query-patient.dto';
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

  findAll(query: QueryPatientDto = {}): Promise<[Patient[], number]> {
    const qb = this.repo
      .createQueryBuilder('patient')
      .leftJoinAndMapOne(
        'patient.account',
        User,
        'account',
        'account.case_id = patient.case_id',
      )
      .leftJoinAndSelect('account.roles', 'role')
      .leftJoinAndSelect('patient.level', 'level')
      .leftJoinAndSelect('patient.operationType', 'operationType');

    // Search by case_id or patient full name
    if (query.search) {
      qb.andWhere(
        '(patient.case_id ILIKE :search OR account.full_name ILIKE :search)',
        { search: `%${query.search}%` },
      );
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
      qb.orderBy('patient.current_pod', query.sortOrder ?? 'ASC', 'NULLS LAST');
    } else {
      // Default: Red → Yellow → Green, then oldest case to the newest (by account creation)
      qb.orderBy('level.sort_order', 'ASC', 'NULLS LAST')
        .addOrderBy('account.created_at', 'ASC', 'NULLS LAST')
        .addOrderBy('patient.case_id', 'ASC');
    }

    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }
}
