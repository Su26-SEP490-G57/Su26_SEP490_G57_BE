import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDeviceDto } from '../dtos/register-device.dto';
import { UserDevice } from '../entities/device.entity';
import { UserRoleName } from '../../user/enums/user-role.enum';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(UserDevice)
    private readonly deviceRepo: Repository<UserDevice>,
  ) {}

  async registerOrUpdate(userId: number, dto: RegisterDeviceDto): Promise<UserDevice> {
    const where = dto.installationId
      ? [{ installationId: dto.installationId }, { fcmToken: dto.fcmToken }]
      : [{ fcmToken: dto.fcmToken }];

    const existing = await this.deviceRepo.findOne({ where });

    const device = existing ?? this.deviceRepo.create();

    device.userId = userId;
    device.installationId = dto.installationId ?? null;
    device.fcmToken = dto.fcmToken;
    device.platform = dto.platform ?? null;
    device.appVersion = dto.appVersion ?? null;
    device.osVersion = dto.osVersion ?? null;
    device.deviceModel = dto.deviceModel ?? null;
    device.timezone = dto.timezone ?? null;
    device.isActive = true;
    device.lastSeenAt = new Date();

    return this.deviceRepo.save(device);
  }

  async deactivateByToken(fcmToken: string): Promise<void> {
    await this.deviceRepo.update({ fcmToken }, { isActive: false });
  }

  async deactivateByInstallationId(installationId: string): Promise<void> {
    await this.deviceRepo.update({ installationId }, { isActive: false });
  }

  async findActiveTokensForUserIds(userIds: number[]): Promise<string[]> {
    if (!userIds.length) {
      return [];
    }

    const rows = await this.deviceRepo
      .createQueryBuilder('device')
      .where('device.userId IN (:...userIds)', { userIds })
      .andWhere('device.isActive = true')
      .select('DISTINCT device.fcmToken', 'fcmToken')
      .getRawMany<{ fcmToken: string }>();

    return rows.map((row) => row.fcmToken).filter(Boolean);
  }

  async findActiveTokensForPatientCase(caseId: string): Promise<string[]> {
    const rows = await this.deviceRepo
      .createQueryBuilder('device')
      .innerJoin('device.user', 'user')
      .where('device.isActive = true')
      .andWhere('user.isActive = true')
      .andWhere('user.caseId = :caseId', { caseId })
      .select('DISTINCT device.fcmToken', 'fcmToken')
      .getRawMany<{ fcmToken: string }>();

    return rows.map((row) => row.fcmToken).filter(Boolean);
  }

  async findActiveTokensForRoles(roleNames: UserRoleName[]): Promise<string[]> {
    if (!roleNames.length) {
      return [];
    }

    const rows = await this.deviceRepo
      .createQueryBuilder('device')
      .innerJoin('device.user', 'user')
      .innerJoin('user.roles', 'role')
      .where('device.isActive = true')
      .andWhere('user.isActive = true')
      .andWhere('role.roleName IN (:...roles)', { roles: roleNames })
      .select('DISTINCT device.fcmToken', 'fcmToken')
      .getRawMany<{ fcmToken: string }>();

    return rows.map((row) => row.fcmToken).filter(Boolean);
  }
}
