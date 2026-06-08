import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user_hoa_new', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Thị Hoa Mới', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'NewPass@99' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ enum: UserRole, isArray: true, example: [UserRole.HEAD_NURSE] })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  @IsOptional()
  roles?: UserRole[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}