import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { ASSIGNABLE_STAFF_ROLES } from '../constants/staff-roles.constant';

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

  @ApiPropertyOptional({ example: '1996-06-02' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityProvince?: string;

  @ApiPropertyOptional({ example: 'Thanh Xuân' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @ApiPropertyOptional({ example: 'Số 1 Nguyễn Trãi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  detailedAddress?: string;

  @ApiPropertyOptional({
    enum: ASSIGNABLE_STAFF_ROLES,
    description: 'Nurse or Doctor — cannot promote to Head Nurse here',
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_STAFF_ROLES)
  role?: UserRoleName.NURSE | UserRoleName.DOCTOR;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
