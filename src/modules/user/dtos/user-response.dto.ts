import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 'user_hoa' })
  username!: string;

  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  fullName!: string;

  @ApiProperty({ example: '0912345678', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: ['Nurse'] })
  roles!: string[];

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2024-06-15T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-06-15T08:00:00.000Z' })
  updatedAt!: Date;
}