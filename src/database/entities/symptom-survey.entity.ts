import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from './patient.entity';

const TRIAGE_STATUSES = ['GREEN', 'YELLOW', 'RED'] as const;

export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

@Entity('symptom_surveys')
export class SymptomSurvey {
  @PrimaryGeneratedColumn({ name: 'survey_id', type: 'int' })
  survey_id!: number;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'pod_day', type: 'int' })
  pod_day!: number;

  @Column({ name: 'nausea_score', type: 'int', default: 0 })
  nausea_score!: number;

  @Column({ name: 'vomiting_score', type: 'int', default: 0 })
  vomiting_score!: number;

  @Column({ name: 'bloating_score', type: 'int', default: 0 })
  bloating_score!: number;

  @Column({ name: 'intake_score', type: 'int', default: 0 })
  intake_score!: number;

  @Column({ name: 'flatus_score', type: 'int', default: 0 })
  flatus_score!: number;

  @Column({ name: 'total_score', type: 'int', default: 0 })
  total_score!: number;

  @Column({ name: 'triage_status', type: 'enum', enum: TRIAGE_STATUSES })
  triage_status!: TriageStatus;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamp' })
  submitted_at!: Date;
}