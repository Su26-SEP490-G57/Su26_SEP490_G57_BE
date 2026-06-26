import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { AssessmentDetail } from './assessment-detail.entity';

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

  @Column({ name: 'total_score', type: 'int', default: 0 })
  total_score!: number;

  @Column({ name: 'triage_color', type: 'varchar', length: 20, nullable: true })
  triage_color!: string | null;

  @OneToMany(() => AssessmentDetail, (detail) => detail.assessment, { eager: false })
  details!: AssessmentDetail[];
}
