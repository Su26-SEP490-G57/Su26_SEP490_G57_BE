import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRoleName } from '../enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'user_hoa', description: 'Unique login username', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @ApiProperty({
    example: 'Abc@12345',
    description: 'Min 8 chars, at least 1 uppercase, 1 number, 1 special character',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Thị Hoa', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({ example: '0912345678', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '1996-06-02' })
  @IsString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  cityProvince?: string;

  @ApiPropertyOptional({ example: 'Thanh Xuân' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  ward?: string;

  @ApiPropertyOptional({ example: 'Số 1 Nguyễn Trãi' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  detailedAddress?: string;

  @ApiPropertyOptional({
    enum: UserRoleName,
    isArray: true,
    example: [UserRoleName.NURSE],
    default: [UserRoleName.NURSE],
  })
  @IsArray()
  @IsEnum(UserRoleName, { each: true })
  @IsOptional()
  roles?: UserRoleName[];
}
