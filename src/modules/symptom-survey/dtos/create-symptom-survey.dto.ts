import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSymptomSurveyDto {
  @ApiProperty({ example: 'CASE-001', description: 'Patient case ID' })
  @IsString()
  @IsNotEmpty()
  case_id!: string;

  @ApiPropertyOptional({ example: 1, description: 'POD day context (Post-Operative Day)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  pod_context?: number;

  @ApiPropertyOptional({ example: 'Day', description: 'Shift period (Day/Night)' })
  @IsOptional()
  @IsString()
  shift_period?: string;

  @ApiProperty({ example: 2, description: 'Nausea score (0-4)', minimum: 0, maximum: 4 })
  @IsInt()
  @Min(0)
  @Max(4)
  nausea_score!: number;

  @ApiProperty({ example: 1, description: 'Vomiting score (0-4)', minimum: 0, maximum: 4 })
  @IsInt()
  @Min(0)
  @Max(4)
  vomiting_score!: number;

  @ApiProperty({ example: 1, description: 'Bloating score (0-4)', minimum: 0, maximum: 4 })
  @IsInt()
  @Min(0)
  @Max(4)
  bloating_score!: number;

  @ApiPropertyOptional({ example: 500.0, description: 'Intake volume in ml' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  intake_volume?: number;

  @ApiPropertyOptional({ example: true, description: 'Has flatus occurred' })
  @IsOptional()
  @IsBoolean()
  is_flatus?: boolean;
}
