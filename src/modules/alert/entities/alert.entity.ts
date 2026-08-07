import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';

export const ALERT_TYPES = ['YELLOW', 'RED'] as const;
export const ALERT_STATUSES = [
  'PENDING_REVIEW',
  'HANDLED',
  'Paused_POD',
  'Rolled_Back',
  'Escalated',
  'CLOSED',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

@Entity('monitoring_alerts')
export class Alert {
  @PrimaryGeneratedColumn({ name: 'alert_id', type: 'int' })
  alertId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'assessment_id', type: 'int' })
  assessmentId!: number;

  @ManyToOne(() => SymptomSurvey, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'assessment_id' })
  survey!: SymptomSurvey;

  @Column({ name: 'survey_score', type: 'int', nullable: true })
  surveyScore!: number | null;

  @Column({ name: 'alert_type', type: 'varchar', length: 10 })
  alertType!: AlertType;

  @Column({ type: 'varchar', length: 50, default: 'Pending' })
  status!: AlertStatus;

  @Column({ name: 'is_auto_progression', type: 'boolean', nullable: true })
  isAutoProgression!: boolean | null;

  @Column({ name: 'triggered_at', type: 'timestamp', nullable: true })
  triggeredAt!: Date | null;

  @Column({ name: 'nurse_action', type: 'varchar', length: 100, nullable: true })
  nurseAction!: string | null;

  @Column({ name: 'nursing_note', type: 'text', nullable: true })
  nursingNote!: string | null;

  @Column({ name: 'handled_at', type: 'timestamp', nullable: true })
  handledAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt!: Date | null;
}
