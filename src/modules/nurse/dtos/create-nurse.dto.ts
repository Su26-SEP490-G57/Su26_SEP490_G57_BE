import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { ASSIGNABLE_STAFF_ROLES } from '../constants/staff-roles.constant';

export class CreateNurseDto {
  @ApiProperty({ example: 'nurse02' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^\S+$/, { message: 'Username must not contain spaces' })
  username!: string;

  @ApiProperty({ example: 'Nurse@123' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @ApiProperty({ example: 'Điều dưỡng 02' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Phone number must start with 0 and be exactly 10 digits' })
  phoneNumber?: string;

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

  @ApiProperty({
    enum: ASSIGNABLE_STAFF_ROLES,
    example: UserRoleName.NURSE,
    description: 'Nurse or Doctor — Head Nurse accounts cannot be created here',
  })
  @IsIn(ASSIGNABLE_STAFF_ROLES)
  role!: UserRoleName.NURSE | UserRoleName.DOCTOR;
}
