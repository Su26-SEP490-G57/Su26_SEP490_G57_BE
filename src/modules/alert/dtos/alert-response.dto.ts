import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AlertResponseDto {
  @ApiProperty({ example: 1 })
  alert_id!: number;

  @ApiProperty({ example: 'CASE-001' })
  case_id!: string;

  @ApiProperty({ example: 5 })
  assessment_id!: number;

  @ApiPropertyOptional({ example: 8 })
  survey_score!: number | null;

  @ApiProperty({ example: 'YELLOW', enum: ['YELLOW', 'RED'] })
  alert_type!: string;

  @ApiProperty({ example: 'Pending' })
  status!: string;

  @ApiPropertyOptional({ example: true })
  is_auto_progression!: boolean | null;

  @ApiPropertyOptional({ example: '2026-06-09T10:00:00.000Z' })
  triggered_at!: Date | null;

  @ApiPropertyOptional({ example: 1 })
  assigned_nurse_id!: number | null;

  @ApiPropertyOptional({ example: '2026-06-09T10:30:00.000Z' })
  acknowledged_at!: Date | null;

  @ApiPropertyOptional({ example: 'Administered antiemetic' })
  nurse_action!: string | null;

  @ApiPropertyOptional({ example: false })
  is_doctor_notified!: boolean | null;

  @ApiPropertyOptional({ example: 'Patient responded well.' })
  nursing_note!: string | null;

  @ApiPropertyOptional({ example: null })
  closed_at!: Date | null;
}

export class PaginatedAlertsDto {
  @ApiProperty({ type: [AlertResponseDto] })
  data!: AlertResponseDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
