import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsOverviewFiltersDto {
  @ApiPropertyOptional({ example: 'CASE-001' })
  search?: string;

  @ApiPropertyOptional({ example: 'Red' })
  level?: string;

  @ApiPropertyOptional({ example: 2 })
  operationTypeId?: number;

  @ApiPropertyOptional({ example: 'P504' })
  room?: string;
}

export class SymptomTrendQuestionDto {
  @ApiProperty({ example: 3 })
  questionId!: number;

  @ApiProperty({
    example: 'bloating',
    description: 'Stable camelCase key for the default question',
  })
  questionKey!: string;

  @ApiProperty({ example: 1.4, description: 'Average score across the cohort for this POD' })
  avgScore!: number;
}

export class SymptomTrendPointDto {
  @ApiProperty({ example: 2, description: 'Post-operative day' })
  pod!: number;

  @ApiProperty({ type: [SymptomTrendQuestionDto] })
  questions!: SymptomTrendQuestionDto[];

  @ApiProperty({ example: 2.1 })
  avgTotalScore!: number;

  @ApiProperty({ example: 12, description: 'Number of assessment submissions for this POD' })
  assessmentCount!: number;

  @ApiProperty({ example: 10, description: 'Distinct patients who submitted for this POD' })
  patientCount!: number;

  @ApiProperty({ example: 1 })
  redCount!: number;

  @ApiProperty({ example: 3 })
  yellowCount!: number;

  @ApiProperty({ example: 8 })
  greenCount!: number;
}

export class ComplianceOverviewDto {
  @ApiProperty({ example: 18 })
  compliant!: number;

  @ApiProperty({ example: 4 })
  nonCompliant!: number;

  @ApiProperty({ example: 2, description: 'ERAS not started (podStartDate is null)' })
  notStarted!: number;

  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 0.82, description: 'compliant / (compliant + nonCompliant)' })
  complianceRate!: number;

  @ApiProperty({ example: 0.8 })
  threshold!: number;
}

export class AnalyticsOverviewResponseDto {
  @ApiProperty({ type: AnalyticsOverviewFiltersDto })
  filters!: AnalyticsOverviewFiltersDto;

  @ApiProperty({ example: 24 })
  patientCount!: number;

  @ApiProperty({ example: 6, nullable: true })
  maxPod!: number | null;

  @ApiProperty({ type: [SymptomTrendPointDto] })
  symptomTrend!: SymptomTrendPointDto[];

  @ApiProperty({ type: ComplianceOverviewDto })
  compliance!: ComplianceOverviewDto;
}
