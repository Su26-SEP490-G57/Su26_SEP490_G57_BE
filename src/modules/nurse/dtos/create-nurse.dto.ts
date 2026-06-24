import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../user/enums/user-role.enum';

export class CreateNurseDto {
  @ApiProperty({ example: 'nurse02' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Nurse@123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Điều dưỡng 02' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ enum: [UserRole.NURSE, UserRole.HEAD_NURSE], example: UserRole.NURSE })
  @IsEnum([UserRole.NURSE, UserRole.HEAD_NURSE])
  role!: UserRole.NURSE | UserRole.HEAD_NURSE;
}
