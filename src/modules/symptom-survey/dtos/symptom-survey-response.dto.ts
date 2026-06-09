import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ example: 2 })
  nausea_score!: number;

  @ApiProperty({ example: 1 })
  vomiting_score!: number;

  @ApiProperty({ example: 1 })
  bloating_score!: number;

  @ApiPropertyOptional({ example: 500.0 })
  intake_volume!: number | null;

  @ApiPropertyOptional({ example: true })
  is_flatus!: boolean | null;

  @ApiProperty({ example: 4 })
  total_score!: number;

  @ApiProperty({ example: 'GREEN', enum: ['GREEN', 'YELLOW', 'RED'] })
  triage_color!: string | null;

  @ApiPropertyOptional({ example: 'Bệnh nhân ổn định. Tiếp tục theo dõi thường quy.' })
  recommendation?: string;
}
