import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from '../../modules/user/entities/user.entity';

const POD_STATUSES = ['Active', 'Paused', 'Rolled_Back', 'Completed'] as const;
const ACTION_TYPES = ['System_Auto', 'Nurse_Acknowledge', 'Nurse_Pause', 'Nurse_Rollback', 'Nurse_Resume', 'Manual_Close'] as const;

export type PodStatus = (typeof POD_STATUSES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];

@Entity('pod_tracking_logs')
export class PodTrackingLog {
  @PrimaryGeneratedColumn({ name: 'log_id', type: 'int' })
  log_id!: number;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'old_pod', type: 'int', nullable: true })
  old_pod!: number | null;

  @Column({ name: 'new_pod', type: 'int', nullable: true })
  new_pod!: number | null;

  @Column({ name: 'old_status', type: 'enum', enum: POD_STATUSES })
  old_status!: PodStatus;

  @Column({ name: 'new_status', type: 'enum', enum: POD_STATUSES })
  new_status!: PodStatus;

  @Column({ name: 'action_type', type: 'enum', enum: ACTION_TYPES })
  action_type!: ActionType;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changed_by!: User | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamp' })
  changed_at!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}