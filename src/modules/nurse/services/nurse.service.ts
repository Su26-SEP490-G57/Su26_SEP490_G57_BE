import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../user/enums/user-role.enum';
import { UsersService } from '../../user/services/users.service';
import { CreateNurseDto } from '../dtos/create-nurse.dto';
import { NurseResponseDto, PaginatedNursesDto } from '../dtos/nurse-response.dto';
import { QueryNurseDto } from '../dtos/query-nurse.dto';
import { UpdateNurseDto } from '../dtos/update-nurse.dto';
import { NurseRepository } from '../repositories/nurse.repository';

@Injectable()
export class NurseService {
  constructor(
    private readonly repository: NurseRepository,
    private readonly usersService: UsersService,
  ) {}

  private toResponse(user: User): NurseResponseDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      roles: (user.roles ?? []).map((r) => r.roleName),
      isActive: user.is_active,
      createdAt: user.created_at,
    };
  }

  async getNurses(query: QueryNurseDto): Promise<PaginatedNursesDto> {
    const [nurses, total] = await this.repository.findAll(query);
    return {
      data: nurses.map((n) => this.toResponse(n)),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };
  }

  async getNurseById(id: number): Promise<NurseResponseDto> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException(`Nurse #${id} not found`);

    const isNurse = (user.roles ?? []).some(
      (r) => r.roleName === UserRole.NURSE || r.roleName === UserRole.HEAD_NURSE,
    );
    if (!isNurse) throw new NotFoundException(`Nurse #${id} not found`);

    return this.toResponse(user);
  }

  async createNurse(dto: CreateNurseDto): Promise<NurseResponseDto> {
    const created = await this.usersService.create({
      username: dto.username,
      password: dto.password,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      roles: [dto.role],
    });
    return {
      id: created.id,
      username: created.username,
      fullName: created.fullName,
      phoneNumber: created.phoneNumber,
      roles: created.roles,
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }

  async updateNurse(id: number, dto: UpdateNurseDto): Promise<NurseResponseDto> {
    await this.getNurseById(id); // verify exists and is nurse

    const updated = await this.usersService.update(id, {
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      password: dto.password,
      isActive: dto.isActive,
      roles: dto.role ? [dto.role] : undefined,
    });

    return {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      phoneNumber: updated.phoneNumber,
      roles: updated.roles,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async deleteNurse(id: number): Promise<NurseResponseDto> {
    await this.getNurseById(id); // verify exists and is nurse
    const deactivated = await this.usersService.deactivate(id);
    return {
      id: deactivated.id,
      username: deactivated.username,
      fullName: deactivated.fullName,
      phoneNumber: deactivated.phoneNumber,
      roles: deactivated.roles,
      isActive: deactivated.isActive,
      createdAt: deactivated.createdAt,
    };
  }
}
