import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TestNotificationDto {
  @ApiProperty({
    example: 'fP5mxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Firebase Cloud Messaging registration token',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    example: 'Test Notification',
    description: 'Notification title',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Hello from NestJS',
    description: 'Notification body',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
