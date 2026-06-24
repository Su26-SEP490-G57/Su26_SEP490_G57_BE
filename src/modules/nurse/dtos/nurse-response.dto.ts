import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NurseResponseDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'nurse01' })
  username!: string;

  @ApiProperty({ example: 'Điều dưỡng 01' })
  fullName!: string;

  @ApiPropertyOptional({ example: '0912345678', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: ['Nurse'] })
  roles!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;
}

export class PaginatedNursesDto {
  @ApiProperty({ type: [NurseResponseDto] })
  data!: NurseResponseDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
