import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dtos/create-user.dto';
import { QueryUserDto } from './dtos/query-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── helpers ──────────────────────────────────────────────
  private toResponse(user: User): UserResponseDto {
    const { password_hash, ...safe } = user;
    return safe as UserResponseDto;
  }

  // ── CRUD ─────────────────────────────────────────────────
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException(`Username "${dto.username}" is already taken`);

    const password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      username:      dto.username,
      password_hash,
      full_name:     dto.full_name,
      role:          dto.role ?? UserRole.NURSE,
    });
    const saved = await this.userRepo.save(user);
    return this.toResponse(saved);
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, status, search } = query;
    const qb = this.userRepo.createQueryBuilder('u')
      .select([
        'u.id', 'u.username', 'u.full_name',
        'u.role', 'u.status', 'u.created_at',
      ]);

    if (role)   qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });
    if (search) qb.andWhere('u.full_name ILIKE :search', { search: `%${search}%` });

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.full_name', 'u.role', 'u.status', 'u.created_at'])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user as UserResponseDto;
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    if (dto.password)  user.password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.role)      user.role      = dto.role;
    if (dto.status)    user.status    = dto.status;

    const saved = await this.userRepo.save(user);
    return this.toResponse(saved);
  }

  async deactivate(id: number): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    user.status = UserStatus.INACTIVE;
    const saved = await this.userRepo.save(user);
    return this.toResponse(saved);
  }

  // Internal use by AuthModule only
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }
}