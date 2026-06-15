import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SurveyQuestion } from './survey-question.entity';

@Entity('question_options')
export class QuestionOption {
  @PrimaryGeneratedColumn({ name: 'option_id', type: 'int' })
  option_id!: number;

  @Column({ name: 'question_id', type: 'int' })
  question_id!: number;

  @ManyToOne(() => SurveyQuestion, (q) => q.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: SurveyQuestion;

  @Column({ name: 'option_text', type: 'varchar', length: 255 })
  option_text!: string;

  @Column({ name: 'score_value', type: 'int' })
  score_value!: number;
}
