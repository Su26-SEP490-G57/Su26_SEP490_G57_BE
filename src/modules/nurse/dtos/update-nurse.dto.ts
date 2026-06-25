import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../user/enums/user-role.enum';

export class UpdateNurseDto {
  @ApiPropertyOptional({ example: 'Điều dưỡng 02 Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345679' })
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Phone number must start with 0 and be exactly 10 digits' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'NewPass@123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
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
