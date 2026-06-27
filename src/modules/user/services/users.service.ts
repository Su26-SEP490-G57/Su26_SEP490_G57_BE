import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dtos/create-user.dto';
import { QueryUserDto } from '../dtos/query-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UsersRepository } from '../repositories/users.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      caseId: user.case_id ?? null,
      roles: (user.roles ?? []).map((r) => r.roleName),
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const exists = await this.usersRepository.findByUsername(dto.username);
    if (exists) throw new ConflictException(`Email "${dto.username}" is already registered`);

    const roleNames = dto.roles?.length ? dto.roles : [UserRole.NURSE];
    const roles = await this.usersRepository.resolveRoles(roleNames);
    const password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = this.usersRepository.createEntity({
      username: dto.username,
      password_hash,
      full_name: dto.fullName,
      phone_number: dto.phoneNumber ?? null,
      roles,
    });

    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  findAll(query: QueryUserDto) {
    return this.usersRepository.findAll(query);
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return this.toResponse(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);

    if (dto.username && dto.username !== user.username) {
      const conflict = await this.usersRepository.findByUsername(dto.username);
      if (conflict) throw new ConflictException(`Email "${dto.username}" is already registered`);
      user.username = dto.username;
    }
    if (dto.fullName) user.full_name = dto.fullName;
    if (dto.phoneNumber !== undefined) user.phone_number = dto.phoneNumber ?? null;
    if (dto.password) user.password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.isActive !== undefined) user.is_active = dto.isActive;
    if (dto.dob !== undefined) user.dob = dto.dob ?? null;
    if (dto.cityProvince !== undefined) user.city_province = dto.cityProvince ?? null;
    if (dto.ward !== undefined) user.ward = dto.ward ?? null;
    if (dto.detailedAddress !== undefined) user.detailed_address = dto.detailedAddress ?? null;
    if (dto.roles?.length) {
      user.roles = await this.usersRepository.resolveRoles(dto.roles);
    }

    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  async deactivate(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);

    user.is_active = false;
    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }
}
