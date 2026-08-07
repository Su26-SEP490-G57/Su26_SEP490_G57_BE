import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { SymptomSurvey } from './symptom-survey.entity';

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'MISSED';
export type ScheduledSlot = 'MORNING' | 'AFTERNOON';

@Entity('assessment_tasks')
export class AssessmentTask {
  @PrimaryGeneratedColumn({ name: 'assessment_task_id', type: 'int' })
  assessmentTaskId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'pod_context', type: 'int' })
  podContext!: number;

  @Column({ name: 'scheduled_slot', type: 'varchar', length: 20 })
  scheduledSlot!: ScheduledSlot;

  @Column({ name: 'opens_at', type: 'timestamp with time zone' })
  opensAt!: Date;

  @Column({ name: 'closes_at', type: 'timestamp with time zone' })
  closesAt!: Date;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status!: TaskStatus;

  @Column({ name: 'assessment_id', type: 'int', nullable: true, unique: true })
  assessmentId!: number | null;

  @ManyToOne(() => SymptomSurvey, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessment_id' })
  assessment!: SymptomSurvey | null;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'missed_at', type: 'timestamp with time zone', nullable: true })
  missedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
