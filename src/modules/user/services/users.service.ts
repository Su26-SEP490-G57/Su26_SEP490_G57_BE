import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dtos/create-user.dto';
import { QueryUserDto } from '../dtos/query-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { User } from '../entities/user.entity';
import { UserRoleName } from '../enums/user-role.enum';
import { UsersRepository } from '../repositories/users.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,

      dob: user.dob ?? null,
      cityProvince: user.cityProvince ?? null,
      ward: user.ward ?? null,
      detailedAddress: user.detailedAddress ?? null,

      caseId: user.caseId ?? null,
      roles: (user.roles ?? []).map((r) => r.roleName),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Throws ConflictException if `username`/`phoneNumber` already belong to another user.
   * `excludeId` lets an update pass through when the value belongs to the user being updated.
   */
  private async assertUnique(
    fields: { username?: string; phoneNumber?: string | null },
    excludeId?: number,
  ): Promise<void> {
    if (fields.username) {
      const existing = await this.usersRepository.findByUsername(fields.username);
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(`Tài khoản "${fields.username}" đã tồn tại trên hệ thống.`);
      }
    }

    if (fields.phoneNumber) {
      const existing = await this.usersRepository.findByPhoneNumber(fields.phoneNumber);
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `Số điện thoại "${fields.phoneNumber}" đã được đăng ký cho tài khoản khác.`,
        );
      }
    }
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    await this.assertUnique({ username: dto.username, phoneNumber: dto.phoneNumber });

    const roleNames = dto.roles?.length ? dto.roles : [UserRoleName.NURSE];
    const roles = await this.usersRepository.resolveRoles(roleNames);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = this.usersRepository.createEntity({
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber ?? null,
      dob: dto.dob ?? null,
      cityProvince: dto.cityProvince ?? null,
      ward: dto.ward ?? null,
      detailedAddress: dto.detailedAddress ?? null,
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
      await this.assertUnique({ username: dto.username }, id);
      user.username = dto.username;
    }

    if (dto.phoneNumber !== undefined && dto.phoneNumber !== user.phoneNumber) {
      await this.assertUnique({ phoneNumber: dto.phoneNumber }, id);
      user.phoneNumber = dto.phoneNumber ?? null;
    }

    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.dob !== undefined) user.dob = dto.dob ?? null;
    if (dto.cityProvince !== undefined) user.cityProvince = dto.cityProvince ?? null;
    if (dto.ward !== undefined) user.ward = dto.ward ?? null;
    if (dto.detailedAddress !== undefined) user.detailedAddress = dto.detailedAddress ?? null;
    if (dto.roles?.length) {
      user.roles = await this.usersRepository.resolveRoles(dto.roles);
    }

    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  async deactivate(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);

    user.isActive = false;
    const saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }
}
