import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ example: 'Administered antiemetic', description: 'Nurse action taken' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nurse_action?: string;

  @ApiPropertyOptional({ example: 'Patient responded well to medication.', description: 'Nursing note' })
  @IsOptional()
  @IsString()
  nursing_note?: string;
}
