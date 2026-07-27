import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { RegisterDeviceDto } from '../../firebase/dtos/register-device.dto';

export class LoginDto {
  @ApiProperty({ example: 'user_hoa' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Abc@12345' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    description: 'Optional device metadata used to register FCM token at login time',
    type: RegisterDeviceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDeviceDto)
  device?: RegisterDeviceDto;
}
