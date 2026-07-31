import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { UsersService } from '../../user/services/users.service';
import { CreateNurseDto } from '../dtos/create-nurse.dto';
import { NurseResponseDto, PaginatedNursesDto } from '../dtos/nurse-response.dto';
import { QueryNurseDto } from '../dtos/query-nurse.dto';
import { UpdateNurseDto } from '../dtos/update-nurse.dto';
import { NurseRepository, NurseStats } from '../repositories/nurse.repository';

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
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      dob: user.dob,
      cityProvince: user.cityProvince,
      ward: user.ward,
      detailedAddress: user.detailedAddress,
      roles: (user.roles ?? []).map((r) => r.roleName),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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

  async getStats(): Promise<NurseStats> {
    return this.repository.getStats();
  }

  async getNurseById(id: number): Promise<NurseResponseDto> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException(`Nurse #${id} not found`);

    const isNurse = (user.roles ?? []).some(
      (r) =>
        r.roleName === UserRoleName.NURSE.toString() ||
        r.roleName === UserRoleName.HEAD_NURSE.toString(),
    );
    if (!isNurse) throw new NotFoundException(`Nurse #${id} not found`);

    return this.toResponse(user);
  }

  async createNurse(dto: CreateNurseDto): Promise<NurseResponseDto> {
    await this.usersService.create({
      username: dto.username,
      password: dto.password,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      dob: dto.dob,
      cityProvince: dto.cityProvince,
      ward: dto.ward,
      detailedAddress: dto.detailedAddress,
      roles: [dto.role],
    });
    // Fetch full user entity to get all fields
    const user = await this.repository.findByUsername(dto.username);
    return this.toResponse(user!);
  }

  async updateNurse(id: number, dto: UpdateNurseDto): Promise<NurseResponseDto> {
    await this.getNurseById(id);
    await this.usersService.update(id, {
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      password: dto.password,
      isActive: dto.isActive,
      dob: dto.dob,
      cityProvince: dto.cityProvince,
      ward: dto.ward,
      detailedAddress: dto.detailedAddress,
      roles: dto.role ? [dto.role] : undefined,
    });
    const user = await this.repository.findById(id);
    return this.toResponse(user!);
  }

  async deleteNurse(id: number): Promise<NurseResponseDto> {
    await this.getNurseById(id);
    await this.usersService.deactivate(id);
    const user = await this.repository.findById(id);
    return this.toResponse(user!);
  }
}
