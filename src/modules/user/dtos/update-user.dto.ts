import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nguyễn Thị Hoa Mới', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: 'NewPass@99' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.HEAD_NURSE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.INACTIVE })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
