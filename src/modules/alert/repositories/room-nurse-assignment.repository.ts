import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomNurseAssignment } from '../entities/room-nurse-assignment.entity';

@Injectable()
export class RoomNurseAssignmentRepository {
  constructor(
    @InjectRepository(RoomNurseAssignment)
    private readonly repo: Repository<RoomNurseAssignment>,
  ) {}

  async getAssignedNurses(roomCode: string): Promise<number[]> {
    const assignments = await this.repo.find({ where: { roomCode } });
    return assignments.map((a) => a.nurseUserId);
  }

  async bulkAssign(roomCodes: string[], nurseIds: number[]): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('room_code IN (:...roomCodes)', { roomCodes })
      .execute();

    const assignments = roomCodes.flatMap((roomCode) =>
      nurseIds.map((nurseId) => this.repo.create({ roomCode, nurseUserId: nurseId })),
    );
    await this.repo.save(assignments);
  }
}
