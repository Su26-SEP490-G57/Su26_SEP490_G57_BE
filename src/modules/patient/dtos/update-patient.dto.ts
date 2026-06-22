import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

/**
 * Update a patient. The case id (primary key) is immutable, so it is omitted.
 * Every other field is optional — only the provided fields are changed on both
 * the patient_cases row and the linked users account.
 */
export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['caseId'] as const),
) {
  @ApiPropertyOptional({ example: true, description: 'Activate/deactivate the linked login account' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
