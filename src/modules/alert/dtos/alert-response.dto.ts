import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AlertResponseDto {
  @ApiProperty({ example: 1 })
  alertId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 5 })
  assessmentId!: number;

  @ApiPropertyOptional({ example: 8 })
  surveyScore!: number | null;

  @ApiProperty({ example: 'YELLOW', enum: ['YELLOW', 'RED'] })
  alertType!: string;

  @ApiProperty({ example: 'Pending' })
  status!: string;

  @ApiPropertyOptional({ example: true })
  isAutoProgression!: boolean | null;

  @ApiPropertyOptional({ example: '2026-06-09T10:00:00.000Z' })
  triggeredAt!: Date | null;

  @ApiPropertyOptional({ example: 'Administered antiemetic' })
  nurseAction!: string | null;

  @ApiPropertyOptional({ example: 'Patient responded well.' })
  nursingNote!: string | null;

  @ApiPropertyOptional({ example: null })
  closedAt!: Date | null;
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
