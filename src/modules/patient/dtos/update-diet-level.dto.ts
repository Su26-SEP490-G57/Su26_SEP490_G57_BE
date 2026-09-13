import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateDietLevelDto {
  @ApiProperty({
    example: 1,
    description: 'New diet level (range 0 to 4)',
  })
  @IsInt()
  @Min(0)
  @Max(4)
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
