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

  @Column({ name: 'questionnaire_version_id', type: 'int' })
  questionnaireVersionId!: number;

  @OneToMany(() => AssessmentDetail, (detail) => detail.assessment, { eager: false })
  details!: AssessmentDetail[];

  /** Legacy score retained only during the compatibility migration period. */
  @Column({ name: 'total_score', type: 'int', default: 0 })
  totalScore!: number;

  /**
   * Phân biệt bài đánh giá khảo sát thường (SURVEY) với đánh giá lại lâm sàng
   * do điều dưỡng tạo thủ công (REASSESSMENT). Mặc định SURVEY để tương thích ngược.
   */
  @Column({ name: 'source', type: 'varchar', length: 20, default: 'SURVEY' })
  source!: 'SURVEY' | 'REASSESSMENT' | 'NOTE';

  /**
   * Ghi chú lâm sàng đính kèm (chỉ dùng cho REASSESSMENT).
   * Null với các bài đánh giá khảo sát thông thường.
   */
  @Column({ name: 'nurse_note', type: 'text', nullable: true })
  nurseNote!: string | null;

  /**
   * ID điều dưỡng tạo đánh giá lại (FK sang users.id).
   * Null với các bài đánh giá khảo sát do bệnh nhân tự làm.
   */
  @Column({ name: 'nurse_id', type: 'int', nullable: true })
  nurseId!: number | null;
}
