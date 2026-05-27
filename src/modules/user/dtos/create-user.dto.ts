import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

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
  full_name!: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.NURSE, default: UserRole.NURSE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}