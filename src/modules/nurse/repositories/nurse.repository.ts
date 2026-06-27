import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QueryNurseDto } from '../dtos/query-nurse.dto';

export interface NurseStats {
  total: number;
  active: number;
  inactive: number;
}

@Injectable()
export class NurseRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async findAll(query: QueryNurseDto): Promise<[User[], number]> {
    const { page = 1, limit = 10, userId, search, isActive } = query;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: ['Nurse', 'Head_Nurse'] });

    if (userId) {
      qb.andWhere('u.id = :userId', { userId });
    }
    if (search) {
      qb.andWhere('u.full_name ILIKE :search', { search: `%${search}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive });
    }

    qb.orderBy('u.full_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  async getStats(): Promise<NurseStats> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: ['Nurse', 'Head_Nurse'] });

    const total = await qb.getCount();
    const active = await qb.clone().andWhere('u.is_active = true').getCount();

    return { total, active, inactive: total - active };
  }
}
