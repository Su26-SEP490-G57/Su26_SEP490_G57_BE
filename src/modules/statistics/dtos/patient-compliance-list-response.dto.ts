import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecoveryMatrixLevelDto } from './recovery-matrix-response.dto';

/**
 * One row of GET /patients/analytics/compliance-list — patient identity
 * (same shape as RecoveryMatrixResponseDto's identity fields) plus the
 * compliance-checklist fields also exposed by GET /patients/:caseId/compliance
 * (PatientComplianceResponseDto).
 */
export class PatientComplianceListItemDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ example: 'P504', nullable: true })
  roomBed!: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiPropertyOptional({ type: RecoveryMatrixLevelDto, nullable: true })
  level!: RecoveryMatrixLevelDto | null;

  @ApiProperty({ example: true })
  viewedGuidance!: boolean;

  @ApiProperty({ example: false })
  viewedEducation!: boolean;

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

  @ApiProperty({ example: 0.75, description: '>= 80% elapsed-POD-day cumulative completion rate' })
  complianceRate!: number;

  @ApiProperty({ example: false })
  isCompliant!: boolean;

  @ApiProperty({
    example: false,
    description:
      'True only if viewedGuidance AND viewedEducation AND BOTH morning/afternoon scheduled ' +
      "assessments for today's POD are COMPLETED.",
  })
  isDailyCompliant!: boolean;
}

export class PaginatedPatientComplianceListDto {
  @ApiProperty({ type: [PatientComplianceListItemDto] })
  data!: PatientComplianceListItemDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
