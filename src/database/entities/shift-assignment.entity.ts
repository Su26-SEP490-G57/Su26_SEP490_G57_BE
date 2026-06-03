import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';

const SHIFT_TYPES = ['Day', 'Night'] as const;

export type ShiftType = (typeof SHIFT_TYPES)[number];

@Entity('shift_assignments')
export class ShiftAssignment {
  @PrimaryGeneratedColumn({ name: 'assignment_id', type: 'int' })
  assignment_id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nurse_id' })
  nurse!: User;

  @Column({ type: 'date' })
  shift_date!: string;

  @Column({ type: 'enum', enum: SHIFT_TYPES })
  shift_type!: ShiftType;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}