import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuestionOption } from './question-option.entity';

@Entity('survey_questions')
export class SurveyQuestion {
  @PrimaryGeneratedColumn({ name: 'question_id', type: 'int' })
  questionId!: number;

  @Column({ name: 'question_text', type: 'text' })
  questionText!: string;

  @Column({ name: 'order_number', type: 'int', nullable: true })
  orderNumber!: number | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @OneToMany(() => QuestionOption, (option) => option.question, { eager: true })
  options!: QuestionOption[];
}
