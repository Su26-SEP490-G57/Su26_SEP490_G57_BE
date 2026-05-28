import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { SymptomSurvey } from './symptom-survey.entity';
import { User } from './user.entity';

const ALERT_LEVELS = ['YELLOW', 'RED'] as const;
const ALERT_STATUSES = ['Pending', 'Acknowledged', 'Paused_POD', 'Rolled_Back', 'Escalated', 'Closed'] as const;

export type AlertLevel = (typeof ALERT_LEVELS)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn({ name: 'alert_id', type: 'int' })
  alert_id!: number;

  @ManyToOne(() => SymptomSurvey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey!: SymptomSurvey;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'alert_level', type: 'enum', enum: ALERT_LEVELS })
  alert_level!: AlertLevel;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ type: 'enum', enum: ALERT_STATUSES, default: 'Pending' })
  status!: AlertStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'handled_by' })
  handled_by!: User | null;

  @Column({ name: 'handled_at', type: 'timestamp', nullable: true })
  handled_at!: Date | null;

  @Column({ name: 'nurse_notes', type: 'text', nullable: true })
  nurse_notes!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}