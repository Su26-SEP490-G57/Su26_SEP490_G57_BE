import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';

/**
 * Mobile-app engagement telemetry for a patient case. There is NO unique
 * constraint on `case_id` — a case may have zero, one, or many rows (e.g. one
 * per sync batch), so reads must always aggregate (`bool_or` / `SUM` grouped
 * by `case_id`) rather than assume a single row per patient.
 *
 * `assessment_completed_count`, `reminder_count`, `app_access_count` are
 * NOT NULL DEFAULT 0 as of `1785000000000-RestoreAppEngagementCounters.ts`.
 */
@Entity('app_engagement_logs')
export class AppEngagementLog {
  @PrimaryGeneratedColumn({ name: 'log_id', type: 'int' })
  logId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'viewed_guidance', type: 'boolean', nullable: true })
  viewedGuidance!: boolean | null;

  @Column({ name: 'viewed_education', type: 'boolean', nullable: true })
  viewedEducation!: boolean | null;

  @Column({ name: 'assessment_completed_count', type: 'int', default: 0 })
  assessmentCompletedCount!: number;

  @Column({ name: 'reminder_count', type: 'int', default: 0 })
  reminderCount!: number;

  @Column({ name: 'app_access_count', type: 'int', default: 0 })
  appAccessCount!: number;
}
