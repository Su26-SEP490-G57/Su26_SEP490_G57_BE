import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user_hoa' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'Abc@12345' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
