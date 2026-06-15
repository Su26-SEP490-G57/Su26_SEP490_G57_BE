import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';
import { User } from '../../user/entities/user.entity';

export const ALERT_TYPES = ['YELLOW', 'RED'] as const;
export const ALERT_STATUSES = ['Pending', 'Acknowledged', 'Paused_POD', 'Rolled_Back', 'Escalated', 'Closed'] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

@Entity('monitoring_alerts')
export class Alert {
  @PrimaryGeneratedColumn({ name: 'alert_id', type: 'int' })
  alert_id!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  case_id!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'assessment_id', type: 'int' })
  assessment_id!: number;

  @ManyToOne(() => SymptomSurvey, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'assessment_id' })
  survey!: SymptomSurvey;

  @Column({ name: 'survey_score', type: 'int', nullable: true })
  survey_score!: number | null;

  @Column({ name: 'alert_type', type: 'varchar', length: 10 })
  alert_type!: AlertType;

  @Column({ type: 'varchar', length: 50, default: 'Pending' })
  status!: AlertStatus;

  @Column({ name: 'is_auto_progression', type: 'boolean', nullable: true })
  is_auto_progression!: boolean | null;

  @Column({ name: 'triggered_at', type: 'timestamp', nullable: true })
  triggered_at!: Date | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_nurse_id' })
  assigned_nurse!: User | null;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledged_at!: Date | null;

  @Column({ name: 'nurse_action', type: 'varchar', length: 100, nullable: true })
  nurse_action!: string | null;

  @Column({ name: 'is_doctor_notified', type: 'boolean', nullable: true })
  is_doctor_notified!: boolean | null;

  @Column({ name: 'nursing_note', type: 'text', nullable: true })
  nursing_note!: string | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closed_at!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;
}
