import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 'user_hoa' })
  username!: string;

  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  fullName!: string;

  @ApiProperty({ example: '0912345678', nullable: true })
  phoneNumber!: string | null;

  @ApiPropertyOptional({
    example: '1998-03-14',
    nullable: true,
  })
  dob?: string | null;

  @ApiPropertyOptional({
    example: 'Hà Nội',
    nullable: true,
  })
  cityProvince?: string | null;

  @ApiPropertyOptional({
    example: 'Phường Dịch Vọng',
    nullable: true,
  })
  ward?: string | null;

  @ApiPropertyOptional({
    example: '123 Nguyễn Văn Cừ',
    nullable: true,
  })
  detailedAddress?: string | null;

  @ApiPropertyOptional({
    example: 'CASE-001',
    nullable: true,
    description: 'Linked patient case ID (Patient role only)',
  })
  caseId?: string | null;

  @ApiProperty({ example: ['Nurse'] })
  roles!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2024-06-15T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-15T08:00:00.000Z' })
  updatedAt!: Date;
}
