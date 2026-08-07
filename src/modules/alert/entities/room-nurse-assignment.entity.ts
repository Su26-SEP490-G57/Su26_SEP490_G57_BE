import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('room_nurse_assignments')
export class RoomNurseAssignment {
  @PrimaryColumn({ name: 'room_code', type: 'varchar', length: 50 })
  roomCode!: string;

  @PrimaryColumn({ name: 'nurse_user_id', type: 'int' })
  nurseUserId!: number;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp with time zone' })
  assignedAt!: Date;
}
