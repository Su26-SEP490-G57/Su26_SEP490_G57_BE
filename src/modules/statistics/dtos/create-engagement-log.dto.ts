import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CreateEngagementLogDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Patient viewed the POD diet guidance content',
  })
  @IsOptional()
  @IsBoolean()
  viewedGuidance?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Patient viewed the health education content',
  })
  @IsOptional()
  @IsBoolean()
  viewedEducation?: boolean;
}
