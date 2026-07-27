import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiPropertyOptional({
    example: 'ios-8b8d0c2f-3f6b-4e4b-8c66-1fdc56c0d2b1',
    description: 'Stable installation identifier from the mobile app',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  installationId?: string;

  @ApiProperty({
    example: 'fP5mxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Firebase Cloud Messaging registration token',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fcmToken!: string;

  @ApiPropertyOptional({ example: 'iOS', description: 'Device platform' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @ApiPropertyOptional({ example: '1.4.2', description: 'Mobile app version' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @ApiPropertyOptional({ example: '17.5.1', description: 'Operating system version' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  osVersion?: string;

  @ApiPropertyOptional({ example: 'iPhone 13', description: 'Device model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceModel?: string;

  @ApiPropertyOptional({ example: 'Asia/Ho_Chi_Minh', description: 'Device timezone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
