import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { QuestionOption } from './question-option.entity';
import { SurveyQuestion } from './survey-question.entity';
import { SymptomSurvey } from './symptom-survey.entity';

@Entity('patient_assessment_details')
export class AssessmentDetail {
  @PrimaryGeneratedColumn({ name: 'detail_id', type: 'int' })
  detailId!: number;

  @Column({ name: 'assessment_id', type: 'int' })
  assessmentId!: number;

  @ManyToOne(() => SymptomSurvey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment!: SymptomSurvey;

  @Column({ name: 'question_id', type: 'int' })
  questionId!: number;

  @ManyToOne(() => SurveyQuestion, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'question_id' })
  question!: SurveyQuestion;

  @Column({ name: 'selected_option_id', type: 'int' })
  selectedOptionId!: number;

  @ManyToOne(() => QuestionOption, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'selected_option_id' })
  selectedOption!: QuestionOption;

  @Column({ name: 'question_text_snapshot', type: 'text', default: '' })
  questionTextSnapshot!: string;

  @Column({ name: 'option_text_snapshot', type: 'varchar', length: 255, default: '' })
  optionTextSnapshot!: string;

  @Column({ name: 'clinical_dimension_snapshot', type: 'varchar', length: 30, default: '' })
  clinicalDimensionSnapshot!: string;

  @Column({ name: 'option_triage_level_snapshot', type: 'varchar', length: 15, default: '' })
  optionTriageLevelSnapshot!: string;

  @Column({ name: 'normalized_value_snapshot', type: 'smallint', nullable: true })
  normalizedValueSnapshot!: number | null;

  @Column({ name: 'matched_alert_rule_ids', type: 'jsonb', default: '[]' })
  matchedAlertRuleIds!: number[];

  /** Legacy score retained only during the compatibility migration period. */
  @Column({ name: 'score_earned', type: 'int' })
  scoreEarned!: number;
}
