import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuestionOption } from './question-option.entity';

@Entity('survey_questions')
export class SurveyQuestion {
  @PrimaryGeneratedColumn({ name: 'question_id', type: 'int' })
  question_id!: number;

  @Column({ name: 'question_text', type: 'text' })
  question_text!: string;

  @Column({ name: 'order_number', type: 'int', nullable: true })
  order_number!: number | null;

  @OneToMany(() => QuestionOption, (option) => option.question, { eager: true })
  options!: QuestionOption[];
}
