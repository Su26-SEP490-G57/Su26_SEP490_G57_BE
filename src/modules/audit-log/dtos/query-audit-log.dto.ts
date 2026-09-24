import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsDateString, IsString } from 'class-validator';

export class QueryAuditLogDto {
  @ApiProperty({ required: false, example: 3, description: 'Filter by user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiProperty({ required: false, example: 'patient_cases', description: 'Filter by entity type' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ required: false, example: 'CASE-001', description: 'Filter by entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false, example: '2026-09-01T00:00:00Z', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2026-09-24T23:59:59Z', description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100, default: 50, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiProperty({ required: false, minimum: 0, default: 0, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
