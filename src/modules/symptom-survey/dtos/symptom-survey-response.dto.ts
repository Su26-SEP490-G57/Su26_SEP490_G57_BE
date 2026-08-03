import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionOptionDto } from './survey-question.dto';

export class AnswerDetailDto {
  @ApiProperty({ example: 1 })
  questionId!: number;

  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  questionText!: string;

  @ApiProperty({ example: 2 })
  selectedOptionId!: number;

  @ApiProperty({ example: 'Nhẹ' })
  optionText!: string;

  @ApiProperty({ example: 1 })
  scoreEarned!: number;
}

export class SymptomSurveyResponseDto {
  @ApiProperty({ example: 1 })
  assessmentId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  evaluationDatetime!: Date;

  @ApiPropertyOptional({ example: 3 })
  podContext!: number | null;

  @ApiProperty({ example: 4 })
  totalScore!: number;

  @ApiProperty({ example: 'GREEN', enum: ['GREEN', 'YELLOW', 'RED'] })
  triageColor!: string | null;

  @ApiPropertyOptional({ type: [AnswerDetailDto] })
  details?: AnswerDetailDto[];

  @ApiPropertyOptional({ example: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy.' })
  recommendation?: string;
}

export class AssessmentHistoryItemDto {
  @ApiProperty({ example: 1 })
  assessmentId!: number;

  @ApiProperty({ example: '2026-07-01T08:30:00.000Z' })
  evaluationDatetime!: Date;

  @ApiPropertyOptional({ example: 2 })
  podContext!: number | null;

  @ApiProperty({ example: 4 })
  totalScore!: number;

  @ApiProperty({ example: 'RED', enum: ['GREEN', 'YELLOW', 'RED'] })
  triageColor!: string | null;

  @ApiProperty({ type: [AnswerDetailDto] })
  details!: AnswerDetailDto[];
}

export class PaginatedAssessmentHistoryDto {
  @ApiProperty({ type: [AssessmentHistoryItemDto] })
  data!: AssessmentHistoryItemDto[];

  @ApiProperty({ example: 15 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}

export class SurveyQuestionDto {
  @ApiProperty({ example: 1 })
  questionId!: number;

  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  questionText!: string;

  @ApiProperty({ example: 1 })
  orderNumber!: number | null;

  @ApiProperty({ example: true, description: 'True for built-in default questions' })
  isDefault!: boolean;

  @ApiProperty({
    example: [{ optionId: 1, optionText: 'Không', scoreValue: 0 } satisfies QuestionOptionDto],
  })
  options!: QuestionOptionDto[];
}

export class PodHistoryItemDto {
  @ApiProperty({ example: '2026-08-03T00:00:00.000Z' })
  date!: Date;

  @ApiProperty({ example: 2 })
  podNumber!: number;

  @ApiProperty({ example: true })
  isAssessed!: boolean;

  @ApiPropertyOptional({ example: 12 })
  assessmentId!: number | null;

  @ApiPropertyOptional({ example: 1 })
  totalScore!: number | null;

  @ApiPropertyOptional({ example: 'GREEN', enum: ['GREEN', 'YELLOW', 'RED'] })
  triageColor!: string | null;

  @ApiProperty({ example: 'Hồi phục tốt' })
  recoveryStatusTag!: string;

  @ApiProperty({ example: 5 })
  completedCount!: number;

  @ApiProperty({ example: 5 })
  totalCount!: number;

  @ApiProperty({ type: [AnswerDetailDto] })
  details!: AnswerDetailDto[];

  @ApiPropertyOptional({ example: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy.' })
  medicalFeedback!: string | null;
}

export class PatientPodTimelineResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 2 })
  currentPod!: number;

  @ApiProperty({ example: false })
  isLocked!: boolean;

  @ApiProperty({ type: [PodHistoryItemDto] })
  history!: PodHistoryItemDto[];
}
