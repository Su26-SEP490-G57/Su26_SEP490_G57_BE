import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateDietLevelDto {
  @ApiProperty({
    example: 1,
    description: 'New diet level (range 0 to 4)',
  })
  @IsInt()
  @Min(0)
  @Max(4)
  dietLevel!: number;
}
