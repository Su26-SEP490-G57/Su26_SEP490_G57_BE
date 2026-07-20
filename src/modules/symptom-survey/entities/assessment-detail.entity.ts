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

  @Column({ name: 'score_earned', type: 'int' })
  scoreEarned!: number;
}
