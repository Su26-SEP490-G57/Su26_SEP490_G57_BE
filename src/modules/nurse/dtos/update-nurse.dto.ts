import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../user/enums/user-role.enum';

export class UpdateNurseDto {
  @ApiPropertyOptional({ example: 'Điều dưỡng 02 Updated' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345679' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'NewPass@123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: [UserRole.NURSE, UserRole.HEAD_NURSE] })
  @IsOptional()
  @IsEnum([UserRole.NURSE, UserRole.HEAD_NURSE])
  role?: UserRole.NURSE | UserRole.HEAD_NURSE;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
