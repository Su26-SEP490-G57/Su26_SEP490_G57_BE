import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryUserDto } from '../dtos/query-user.dto';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

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
    passwordHash: string;
    fullName: string;
    phoneNumber?: string | null;
    dob?: string | null;
    cityProvince?: string | null;
    ward?: string | null;
    detailedAddress?: string | null;
    roles: Role[];
  }): User {
    return this.userRepo.create({
      username: data.username,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber ?? null,
      dob: data.dob ?? null,
      cityProvince: data.cityProvince ?? null,
      ward: data.ward ?? null,
      detailedAddress: data.detailedAddress ?? null,
      isActive: true,
      roles: data.roles,
    });
  }

  save(user: User): Promise<User> {
    return this.userRepo.save(user);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phoneNumber } });
  }

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, isActive, search, userId } = query;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'role')
      .select([
        'u.id',
        'u.username',
        'u.fullName',
        'u.phoneNumber',
        'u.isActive',
        'u.createdAt',
        'u.updatedAt',
        'role.id',
        'role.roleName',
      ]);

    if (role) {
      qb.andWhere('role.roleName = :role', { role });
    }
    if (isActive !== undefined) {
      qb.andWhere('u.isActive = :isActive', { isActive });
    }
    if (search) {
      qb.andWhere('u.fullName ILIKE :search', { search: `%${search}%` });
    }
    if (userId) {
      qb.andWhere('u.id = :userId', { userId });
    }

    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
