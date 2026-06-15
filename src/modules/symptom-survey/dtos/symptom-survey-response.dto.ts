import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnswerDetailDto {
  @ApiProperty({ example: 1 })
  question_id!: number;

  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  question_text!: string;

  @ApiProperty({ example: 2 })
  selected_option_id!: number;

  @ApiProperty({ example: 'Nhẹ' })
  option_text!: string;

  @ApiProperty({ example: 1 })
  score_earned!: number;
}

export class SymptomSurveyResponseDto {
  @ApiProperty({ example: 1 })
  assessment_id!: number;

  @ApiProperty({ example: 'CASE-001' })
  case_id!: string;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  evaluation_datetime!: Date;

  @ApiPropertyOptional({ example: 3 })
  pod_context!: number | null;

  @ApiPropertyOptional({ example: 'Day' })
  shift_period!: string | null;

  @ApiProperty({ example: 4 })
  total_score!: number;

  @ApiProperty({ example: 'GREEN', enum: ['GREEN', 'YELLOW', 'RED'] })
  triage_color!: string | null;

  @ApiPropertyOptional({ type: [AnswerDetailDto] })
  details?: AnswerDetailDto[];

  @ApiPropertyOptional({ example: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy.' })
  recommendation?: string;
}

export class SurveyQuestionDto {
  @ApiProperty({ example: 1 })
  question_id!: number;

  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  question_text!: string;

  @ApiProperty({ example: 1 })
  order_number!: number | null;

  @ApiProperty({
    example: [{ option_id: 1, option_text: 'Không', score_value: 0 }],
  })
  options!: { option_id: number; option_text: string; score_value: number }[];
}
