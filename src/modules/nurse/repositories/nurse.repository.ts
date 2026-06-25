import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QueryNurseDto } from '../dtos/query-nurse.dto';

@Injectable()
export class NurseRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(query: QueryNurseDto): Promise<[User[], number]> {
    const { page = 1, limit = 10, userId, search } = query;

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

    qb.orderBy('u.full_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }
}
