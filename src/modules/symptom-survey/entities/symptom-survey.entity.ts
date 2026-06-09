import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';

@Entity('patient_assessments')
export class SymptomSurvey {
  @PrimaryGeneratedColumn({ name: 'assessment_id', type: 'int' })
  assessment_id!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  case_id!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'evaluation_datetime', type: 'timestamp' })
  evaluation_datetime!: Date;

  @Column({ name: 'pod_context', type: 'int', nullable: true })
  pod_context!: number | null;

  @Column({ name: 'shift_period', type: 'varchar', length: 20, nullable: true })
  shift_period!: string | null;

  @Column({ name: 'nausea_score', type: 'int', default: 0 })
  nausea_score!: number;

  @Column({ name: 'vomiting_score', type: 'int', default: 0 })
  vomiting_score!: number;

  @Column({ name: 'bloating_score', type: 'int', default: 0 })
  bloating_score!: number;

  @Column({ name: 'intake_volume', type: 'float', nullable: true })
  intake_volume!: number | null;

  @Column({ name: 'is_flatus', type: 'boolean', nullable: true })
  is_flatus!: boolean | null;

  @Column({ name: 'total_score', type: 'int', default: 0 })
  total_score!: number;

  @Column({ name: 'triage_color', type: 'varchar', length: 20, nullable: true })
  triage_color!: string | null;
}
