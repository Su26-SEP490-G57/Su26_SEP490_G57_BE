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
    description:
      'Number of POD days where both scheduled assessments (MORNING and AFTERNOON) are COMPLETED',
  })
  assessmentCompletedCount!: number;

  @ApiProperty({ example: 4, description: 'currentPod + 1' })
  expectedAssessmentCount!: number;

  @ApiProperty({ example: 0.75 })
  complianceRate!: number;

  @ApiProperty({ example: false })
  isCompliant!: boolean;

  @ApiPropertyOptional({
    example: 'COMPLETED',
    enum: ['PENDING', 'COMPLETED', 'MISSED'],
    nullable: true,
    description:
      "Status of today's (currentPod) MORNING (06:00-08:00) scheduled assessment. " +
      'null when the patient has no active POD (ERAS not started).',
  })
  morningAssessmentStatus!: 'PENDING' | 'COMPLETED' | 'MISSED' | null;

  @ApiPropertyOptional({
    example: 'PENDING',
    enum: ['PENDING', 'COMPLETED', 'MISSED'],
    nullable: true,
    description:
      "Status of today's (currentPod) AFTERNOON (16:00-18:00) scheduled assessment. " +
      'null when the patient has no active POD (ERAS not started).',
  })
  afternoonAssessmentStatus!: 'PENDING' | 'COMPLETED' | 'MISSED' | null;

  @ApiProperty({
    example: false,
    description:
      'True only if viewedGuidance AND viewedEducation AND BOTH morning/afternoon scheduled ' +
      "assessments for today's POD are COMPLETED. Distinct from isCompliant, which is the " +
      '>= 80% cumulative rate across all elapsed POD days.',
  })
  isDailyCompliant!: boolean;
}
