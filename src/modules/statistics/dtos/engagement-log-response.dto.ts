import { ApiProperty } from '@nestjs/swagger';

export class EngagementLogResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: true, nullable: true })
  viewedGuidance!: boolean | null;

  @ApiProperty({ example: null, nullable: true })
  viewedEducation!: boolean | null;
}
