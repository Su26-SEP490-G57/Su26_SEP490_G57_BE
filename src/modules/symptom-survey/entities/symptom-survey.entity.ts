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

  @Column({ name: 'assessment_type', type: 'varchar', length: 20, default: 'SCHEDULED' })
  assessmentType!: 'SCHEDULED' | 'TRIGGERED';

  @Column({ name: 'scheduled_slot', type: 'varchar', length: 20, nullable: true })
  scheduledSlot!: 'MORNING' | 'AFTERNOON' | null;

  @Column({ name: 'triage_triggers', type: 'jsonb', default: '[]' })
  triageTriggers!: any[];

  @Column({ name: 'triage_color', type: 'varchar', length: 20, nullable: true })
  triageColor!: string | null;

  @Column({ name: 'triage_verdict_snapshot', type: 'varchar', length: 20, nullable: true })
  triageVerdictSnapshot!: string | null;

  @Column({ name: 'questionnaire_version_id', type: 'int' })
  questionnaireVersionId!: number;

  @OneToMany(() => AssessmentDetail, (detail) => detail.assessment, { eager: false })
  details!: AssessmentDetail[];

  /** Legacy score retained only during the compatibility migration period. */
  @Column({ name: 'total_score', type: 'int', default: 0 })
  totalScore!: number;
}
