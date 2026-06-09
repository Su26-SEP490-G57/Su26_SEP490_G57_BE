import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ALERT_STATUSES, ALERT_TYPES, AlertStatus, AlertType } from '../entities/alert.entity';

export class QueryAlertDto {
  @ApiPropertyOptional({ example: 'CASE-001', description: 'Filter by patient case ID' })
  @IsOptional()
  @IsString()
  caseId?: string;

  @ApiPropertyOptional({ enum: ALERT_STATUSES, description: 'Filter by alert status' })
  @IsOptional()
  @IsIn(ALERT_STATUSES)
  status?: AlertStatus;

  @ApiPropertyOptional({ enum: ALERT_TYPES, description: 'Filter by alert type' })
  @IsOptional()
  @IsIn(ALERT_TYPES)
  alertType?: AlertType;

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
