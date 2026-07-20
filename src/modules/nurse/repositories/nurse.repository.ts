import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserRoleName } from '../../user/enums/user-role.enum';
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
    const nurseRoles = [UserRoleName.NURSE, UserRoleName.HEAD_NURSE];

    const applyFilters = (qb: ReturnType<typeof this.userRepo.createQueryBuilder>) => {
      if (userId) qb.andWhere('u.id = :userId', { userId });
      if (search) qb.andWhere('u.full_name ILIKE :search', { search: `%${search}%` });
      if (isActive !== undefined) qb.andWhere('u.is_active = :isActive', { isActive });
    };

    // Count query: leftJoin only (no select) → no row multiplication from roles
    const countQb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: nurseRoles });
    applyFilters(countQb);
    const total = await countQb.getCount();

    // Data query: leftJoinAndSelect to load roles for the response
    const dataQb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: nurseRoles });
    applyFilters(dataQb);
    const nurses = await dataQb
      .orderBy('u.full_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return [nurses, total];
  }

  async getStats(): Promise<NurseStats> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'role')
      .where('role.roleName IN (:...roles)', {
        roles: [UserRoleName.NURSE, UserRoleName.HEAD_NURSE],
      });

    const total = await qb.getCount();
    const active = await qb.clone().andWhere('u.is_active = true').getCount();

    return { total, active, inactive: total - active };
  }
}
