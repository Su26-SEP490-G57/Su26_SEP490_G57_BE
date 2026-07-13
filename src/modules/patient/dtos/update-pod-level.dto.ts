import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdatePodLevelDto {
  @ApiProperty({
    example: 2,
    description: 'New POD level (must be >= 0 and < current_pod)',
  })
  @IsInt()
  @Min(0)
  podLevel!: number;
}
