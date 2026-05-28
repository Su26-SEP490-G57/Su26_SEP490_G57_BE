import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dtos/create-user.dto';
import { QueryUserDto } from '../dtos/query-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { User } from '../../../database/entities/user.entity';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { UsersRepository } from '../repositories/users.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  private toResponse(user: User): UserResponseDto {
    let { password_hash, ...safe } = user;
    return safe as UserResponseDto;
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    let exists = await this.usersRepository.findByUsername(dto.username);
    if (exists) throw new ConflictException(`Username "${dto.username}" is already taken`);

    let password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    let user = this.usersRepository.create({ ...dto, password_hash });
    let saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  findAll(query: QueryUserDto) {
    return this.usersRepository.findAll(query);
  }

  async findOne(id: number): Promise<UserResponseDto> {
    let user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return this.toResponse(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    let user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);

    if (dto.password) user.password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;

    let saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  async deactivate(id: number): Promise<UserResponseDto> {
    let user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);

    user.status = UserStatus.INACTIVE;
    let saved = await this.usersRepository.save(user);
    return this.toResponse(saved);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }
}