import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { QueryPatientDto } from '../../patient/dtos/query-patient.dto';

export const OVERALL_STATUSES = ['ALL', 'COMPLIANT', 'NON_COMPLIANT'] as const;
export type OverallStatus = (typeof OVERALL_STATUSES)[number];

/** Same querystring-boolean coercion used by QueryNurseDto/QueryUserDto. */
const toOptionalBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

/**
 * Filters for GET /patients/analytics/compliance-list (Nurse Dashboard
 * "Non-Compliant Patients Detail Screen", SEP490-414). Shares the cohort
 * filter vocabulary of GET /patients (search / level / operationTypeId /
 * room / nurseUserId) plus compliance-checklist-specific filters.
 */
export class QueryPatientComplianceListDto extends PickType(QueryPatientDto, [
  'search',
  'level',
  'operationTypeId',
  'room',
  'nurseUserId',
] as const) {
  @ApiPropertyOptional({
    enum: OVERALL_STATUSES,
    default: 'ALL',
    description: 'Filter by overall (cumulative, >= 80% elapsed-POD-day) compliance status',
  })
  @IsOptional()
  @IsIn(OVERALL_STATUSES)
  overallStatus?: OverallStatus = 'ALL';

  @ApiPropertyOptional({
    example: true,
    description: 'Only patients who have NOT viewed POD diet guidance content',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  dietaryNotViewed?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Only patients who have NOT viewed health education content',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  healthEducationNotViewed?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Only patients whose today's (currentPod) MORNING assessment is MISSED",
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  missedMorning?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Only patients whose today's (currentPod) AFTERNOON assessment is MISSED",
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  missedAfternoon?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      "Only patients whose today's (currentPod) MORNING and AFTERNOON assessments are BOTH MISSED",
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  missedBoth?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Page number (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page (default: 20)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
