import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Patient } from './patient.entity';

/**
 * Postgres enum values for `pod_protocol_tracking_logs.action_type`, exactly as
 * created by the `pod_tracking_logs_action_type_enum` type in
 * `1780912799-create-core-table.ts`. Keep in sync with that migration.
 */
export const POD_TRACKING_ACTION_TYPES = [
  'System_Auto',
  'Nurse_Acknowledge',
  'Nurse_Pause',
  'Nurse_Rollback',
  'Nurse_Resume',
  'Manual_Close',
] as const;
export type PodTrackingActionType = (typeof POD_TRACKING_ACTION_TYPES)[number];

/**
 * Audit trail of POD-protocol status transitions (auto progression, nurse
 * holds/resumes/rollbacks, manual close) for a patient case. Written to by
 * `PatientService` whenever a case's POD lock state or POD level changes
 * (see `lockPod` / `updatePodLevel`), and read by the analytics dashboard
 * (`StatisticsService`) to derive hold/rollback counts.
 */
@Entity('pod_protocol_tracking_logs')
export class PodProtocolTrackingLog {
  @PrimaryGeneratedColumn({ name: 'log_id', type: 'int' })
  logId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'pod_number', type: 'int', nullable: true })
  podNumber!: number | null;

  @Column({ name: 'old_status', type: 'varchar', length: 50 })
  oldStatus!: string;

  @Column({ name: 'new_status', type: 'varchar', length: 50 })
  newStatus!: string;

  // Reuses the existing `pod_tracking_logs_action_type_enum` Postgres type
  // (created by the core-table migration) — enumName pins TypeORM to that
  // type name so `migration:generate` doesn't propose creating a new enum.
  @Column({
    name: 'action_type',
    type: 'enum',
    enum: POD_TRACKING_ACTION_TYPES,
    enumName: 'pod_tracking_logs_action_type_enum',
  })
  actionType!: PodTrackingActionType;

  @Column({ name: 'changed_by', type: 'int', nullable: true })
  changedById!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'changed_by' })
  changedBy!: User | null;

  @Column({ name: 'hold_reason', type: 'text', nullable: true })
  holdReason!: string | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamp' })
  changedAt!: Date;
}
