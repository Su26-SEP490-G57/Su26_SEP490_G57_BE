import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryNurseDto {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ example: 3, description: 'Filter by exact user_id' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({ example: true, description: 'Filter by active status' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Hoa', description: 'Search by full_name (partial match)' })
  @IsString()
  @IsOptional()
  search?: string;
}
