import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class UpdateDietLevelDto {
  @ApiProperty({
    example: 0,
    description: 'New diet level (0 to max protocol dietLevel)',
  })
  @IsInt()
  @Min(0)
  dietLevel!: number;

  @ApiProperty({
    example: 'Bệnh nhân đã dung nạp tốt chế độ ăn hiện tại.',
    description: 'Clinical reason for changing the diet level',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
