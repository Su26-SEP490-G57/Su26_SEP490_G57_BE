import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { LevelName } from '../entities/level.entity';
import { LEVEL_NAMES } from '../entities/level.entity';

export const PATIENT_SORT_FIELDS = ['pod'] as const;
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['ASC', 'DESC'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class QueryPatientDto {
  @ApiPropertyOptional({
    description: 'Search by case ID or patient full name (case-insensitive, partial match)',
    example: 'CASE-001',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: LEVEL_NAMES,
    description: 'Filter by care/risk level',
    example: 'Red',
  })
  @IsOptional()
  @IsIn(LEVEL_NAMES)
  level?: LevelName;

  @ApiPropertyOptional({
    description: 'Filter by operation type id',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  operationTypeId?: number;

  @ApiPropertyOptional({
    enum: PATIENT_SORT_FIELDS,
    description:
      'Column to sort by. When omitted, defaults to level (Red→Yellow→Green) then oldest case first.',
    example: 'pod',
  })
  @IsOptional()
  @IsIn(PATIENT_SORT_FIELDS)
  sortBy?: PatientSortField;

  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    description: 'Sort direction (only applies when sortBy is set). Default ASC.',
    example: 'ASC',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : (value as never)))
  @IsIn(SORT_ORDERS)
  sortOrder?: SortOrder = 'ASC';

  @ApiPropertyOptional({ example: 1, description: 'Page number (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page (default: 10)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
