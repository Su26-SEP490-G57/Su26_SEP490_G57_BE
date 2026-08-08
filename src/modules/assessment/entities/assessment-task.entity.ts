import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { SymptomSurvey } from '../../symptom-survey/entities/symptom-survey.entity';

@Entity('assessment_tasks')
export class AssessmentTask {
  @PrimaryGeneratedColumn({ name: 'assessment_task_id', type: 'int' })
  assessmentTaskId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'pod_context', type: 'int' })
  podContext!: number;

  @Column({ name: 'scheduled_slot', type: 'varchar', length: 20 }) // 'MORNING' | 'AFTERNOON'
  scheduledSlot!: string;

  @Column({ name: 'opens_at', type: 'timestamptz' })
  opensAt!: Date;

  @Column({ name: 'closes_at', type: 'timestamptz' })
  closesAt!: Date;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status!: 'PENDING' | 'COMPLETED' | 'MISSED';

  @Column({ name: 'assessment_id', type: 'int', nullable: true })
  assessmentId!: number | null;

  @ManyToOne(() => SymptomSurvey)
  @JoinColumn({ name: 'assessment_id' })
  assessment!: SymptomSurvey | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
