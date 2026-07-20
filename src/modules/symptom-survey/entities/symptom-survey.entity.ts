import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { AssessmentDetail } from './assessment-detail.entity';

@Entity('patient_assessments')
export class SymptomSurvey {
  @PrimaryGeneratedColumn({ name: 'assessment_id', type: 'int' })
  assessmentId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'evaluation_datetime', type: 'timestamp' })
  evaluationDatetime!: Date;

  @Column({ name: 'pod_context', type: 'int', nullable: true })
  podContext!: number | null;

  @Column({ name: 'total_score', type: 'int', default: 0 })
  totalScore!: number;

  @Column({ name: 'triage_color', type: 'varchar', length: 20, nullable: true })
  triageColor!: string | null;

  @OneToMany(() => AssessmentDetail, (detail) => detail.assessment, { eager: false })
  details!: AssessmentDetail[];
}
