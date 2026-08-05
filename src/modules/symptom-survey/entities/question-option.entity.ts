import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SurveyQuestion } from './survey-question.entity';

@Entity('question_options')
export class QuestionOption {
  @PrimaryGeneratedColumn({ name: 'option_id', type: 'int' })
  optionId!: number;

  @Column({ name: 'question_id', type: 'int' })
  questionId!: number;

  @ManyToOne(() => SurveyQuestion, (q) => q.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: SurveyQuestion;

  @Column({ name: 'option_text', type: 'varchar', length: 255 })
  optionText!: string;

  /** Legacy score retained only during the compatibility migration period. */
  @Column({ name: 'score_value', type: 'int' })
  scoreValue!: number;

  @Column({ name: 'option_triage_level', type: 'varchar', length: 15, nullable: true })
  optionTriageLevel!: 'GREEN' | 'YELLOW' | 'RED' | null;

  @Column({ name: 'option_definition', type: 'text', nullable: true })
  optionDefinition!: string | null;

  /** Normalized clinical value; currently used by the VOMITING dimension. */
  @Column({ name: 'normalized_value', type: 'smallint', nullable: true })
  normalizedValue!: number | null;
}
