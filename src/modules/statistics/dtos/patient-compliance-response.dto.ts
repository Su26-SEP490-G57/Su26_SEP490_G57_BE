import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientComplianceResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiProperty({ example: true, description: 'Whether any app_engagement_logs row exists' })
  hasEngagementLog!: boolean;

  @ApiProperty({ example: true })
  viewedGuidance!: boolean;

  @ApiProperty({ example: false })
  viewedEducation!: boolean;

  @ApiProperty({ example: 5 })
  reminderCount!: number;

  @ApiProperty({ example: 12 })
  appAccessCount!: number;

  @ApiProperty({
    example: 3,
    description: 'COUNT(DISTINCT pod_context) from patient_assessments — authoritative',
  })
  assessmentCompletedCount!: number;

  @ApiProperty({ example: 4, description: 'currentPod + 1' })
  expectedAssessmentCount!: number;

  @ApiProperty({ example: 0.75 })
  complianceRate!: number;

  @ApiProperty({ example: false })
  isCompliant!: boolean;
}
