import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../user/enums/user-role.enum';

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

  @ApiProperty({ enum: [UserRole.NURSE, UserRole.HEAD_NURSE], example: UserRole.NURSE })
  @IsEnum([UserRole.NURSE, UserRole.HEAD_NURSE])
  role!: UserRole.NURSE | UserRole.HEAD_NURSE;
}
