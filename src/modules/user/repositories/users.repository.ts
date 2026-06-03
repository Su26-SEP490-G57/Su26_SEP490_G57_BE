import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dtos/create-user.dto';
import { QueryUserDto } from '../dtos/query-user.dto';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  create(userData: CreateUserDto & { password_hash: string }) {
    return this.userRepo.create({
      username: userData.username,
      password_hash: userData.password_hash,
      full_name: userData.fullName,
      role: userData.role ?? UserRole.NURSE,
      status: UserStatus.ACTIVE,
    });
  }

  save(user: User) {
    return this.userRepo.save(user);
  }

  findByUsername(username: string) {
    return this.userRepo.findOne({ where: { username } });
  }

  findById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, status, search } = query;
    const qb = this.userRepo.createQueryBuilder('u')
      .select([
        'u.id', 'u.username', 'u.full_name',
        'u.role', 'u.status', 'u.created_at',
      ]);

    if (role) qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });
    if (search) qb.andWhere('u.full_name ILIKE :search', { search: `%${search}%` });

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount().then(([data, total]) => ({ data, total, page, limit }));
  }
}
