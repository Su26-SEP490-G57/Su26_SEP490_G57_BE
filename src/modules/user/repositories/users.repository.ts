import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { QueryUserDto } from '../dtos/query-user.dto';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /** Resolve role name strings to Role entities (creates row if absent — useful for seeding) */
  async resolveRoles(roleNames: string[]): Promise<Role[]> {
    return Promise.all(
      roleNames.map(async (name) => {
        let role = await this.roleRepo.findOne({ where: { roleName: name } });
        if (!role) {
          role = this.roleRepo.create({ roleName: name });
          await this.roleRepo.save(role);
        }
        return role;
      }),
    );
  }

  createEntity(data: {
    username: string;
    password_hash: string;
    full_name: string;
    phone_number?: string | null;
    roles: Role[];
  }): User {
    return this.userRepo.create({
      username: data.username,
      password_hash: data.password_hash,
      full_name: data.full_name,
      phone_number: data.phone_number ?? null,
      is_active: true,
      roles: data.roles,
    });
  }

  save(user: User): Promise<User> {
    return this.userRepo.save(user);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, isActive, search } = query;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'role')
      .select([
        'u.id',
        'u.username',
        'u.full_name',
        'u.phone_number',
        'u.is_active',
        'u.created_at',
        'u.updated_at',
        'role.id',
        'role.roleName',
      ]);

    if (role) {
      qb.andWhere('role.roleName = :role', { role });
    }
    if (isActive !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive });
    }
    if (search) {
      qb.andWhere('u.full_name ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}