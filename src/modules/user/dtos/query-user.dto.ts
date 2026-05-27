import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';

export class QueryUserDto {
  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number) @IsInt() @Min(1) @Max(50) @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.NURSE })
  @IsEnum(UserRole) @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsEnum(UserStatus) @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'Hoa', description: 'Search by full_name (partial match)' })
  @IsString() @IsOptional()
  search?: string;
}