import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('room_nurse_assignments')
export class RoomNurseAssignment {
  @PrimaryColumn({ name: 'room_code', type: 'varchar', length: 50 })
  roomCode!: string;

  @PrimaryColumn({ name: 'nurse_user_id', type: 'integer' })
  nurseUserId!: number;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'NOW()' })
  assignedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nurse_user_id' })
  nurse?: User;
}
