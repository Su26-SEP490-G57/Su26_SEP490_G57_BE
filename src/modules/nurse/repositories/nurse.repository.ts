import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { QueryNurseDto } from '../dtos/query-nurse.dto';

export interface NurseStats {
  total: number;
  active: number;
  inactive: number;
}

@Injectable()
export class NurseRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async findAll(query: QueryNurseDto): Promise<[User[], number]> {
    const { page = 1, limit = 10, userId, search, isActive } = query;
    const nurseRoles = [UserRoleName.NURSE, UserRoleName.HEAD_NURSE];

    const applyFilters = (qb: ReturnType<typeof this.userRepo.createQueryBuilder>) => {
      if (userId) qb.andWhere('u.id = :userId', { userId });
      if (search) qb.andWhere('u.fullName ILIKE :search', { search: `%${search}%` });
      if (isActive !== undefined) qb.andWhere('u.isActive = :isActive', { isActive });
    };

    // Count query: leftJoin only (no select) → no row multiplication from roles
    const countQb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: nurseRoles });
    applyFilters(countQb);
    const total = await countQb.getCount();

    // Data query: leftJoinAndSelect to load roles for the response
    const dataQb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'role')
      .where('role.roleName IN (:...roles)', { roles: nurseRoles });
    applyFilters(dataQb);
    const nurses = await dataQb
      .orderBy('u.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return [nurses, total];
  }

  async getStats(): Promise<NurseStats> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'role')
      .where('role.roleName IN (:...roles)', {
        roles: [UserRoleName.NURSE, UserRoleName.HEAD_NURSE],
      });

    const total = await qb.getCount();
    const active = await qb.clone().andWhere('u.isActive = :active', { active: true }).getCount();

    return { total, active, inactive: total - active };
  }

  async findAssignedRoomsByNurse(nurseUserId: number): Promise<string[]> {
    const rows = await this.userRepo.manager.query<{ room_code: string }[]>(
      `SELECT room_code FROM room_nurse_assignments WHERE nurse_user_id = $1 ORDER BY room_code ASC`,
      [nurseUserId],
    );
    return rows.map((r) => r.room_code);
  }

  async findAssignedRoomsForNurses(nurseUserIds: number[]): Promise<Map<number, string[]>> {
    const map = new Map<number, string[]>();
    if (nurseUserIds.length === 0) return map;

    const rows = await this.userRepo.manager.query<{ nurse_user_id: number; room_code: string }[]>(
      `SELECT nurse_user_id, room_code FROM room_nurse_assignments WHERE nurse_user_id = ANY($1) ORDER BY room_code ASC`,
      [nurseUserIds],
    );

    for (const r of rows) {
      if (!map.has(r.nurse_user_id)) {
        map.set(r.nurse_user_id, []);
      }
      map.get(r.nurse_user_id)!.push(r.room_code);
    }
    return map;
  }

  async assignRoomsToNurse(nurseUserId: number, roomCodes: string[]): Promise<string[]> {
    const cleanRoomCodes = Array.from(new Set(roomCodes.map((r) => r.trim()).filter(Boolean)));

    await this.userRepo.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.query(
        `DELETE FROM room_nurse_assignments WHERE nurse_user_id = $1`,
        [nurseUserId],
      );

      for (const roomCode of cleanRoomCodes) {
        await transactionalEntityManager.query(
          `INSERT INTO room_nurse_assignments (room_code, nurse_user_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [roomCode, nurseUserId],
        );
      }
    });

    return cleanRoomCodes;
  }

  async removeRoomAssignment(nurseUserId: number, roomCode: string): Promise<void> {
    await this.userRepo.manager.query(
      `DELETE FROM room_nurse_assignments WHERE nurse_user_id = $1 AND room_code = $2`,
      [nurseUserId, roomCode],
    );
  }

  async getAllHospitalRooms(): Promise<{ roomCode: string; patientCount: number }[]> {
    const rows = await this.userRepo.manager.query<{ room_code: string; patient_count: string }[]>(`
      SELECT 
        split_part(room_bed, '/', 1) AS room_code,
        COUNT(*)::int AS patient_count
      FROM patient_cases
      WHERE room_bed IS NOT NULL AND room_bed != '' AND eras_completed = false
      GROUP BY split_part(room_bed, '/', 1)
      ORDER BY room_code ASC
    `);

    return rows.map((r) => ({
      roomCode: r.room_code,
      patientCount: parseInt(r.patient_count ?? '0', 10),
    }));
  }
}
