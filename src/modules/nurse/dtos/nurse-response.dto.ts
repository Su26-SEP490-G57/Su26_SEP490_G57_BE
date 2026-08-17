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

  @ApiPropertyOptional({ example: '1996-06-02', nullable: true })
  dob!: string | null;

  @ApiPropertyOptional({ example: 'Hà Nội', nullable: true })
  cityProvince!: string | null;

  @ApiPropertyOptional({ example: 'Thanh Xuân', nullable: true })
  ward!: string | null;

  @ApiPropertyOptional({ example: 'Số 1 Nguyễn Trãi', nullable: true })
  detailedAddress!: string | null;

  @ApiProperty({ example: ['Nurse'] })
  roles!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: ['P502', 'P503'], description: 'Rooms assigned to nurse' })
  assignedRooms?: string[];

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-20T00:00:00.000Z' })
  updatedAt!: Date;
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
