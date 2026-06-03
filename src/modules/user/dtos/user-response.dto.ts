  import { ApiProperty } from '@nestjs/swagger';
  import { UserRole } from '../enums/user-role.enum';
  import { UserStatus } from '../enums/user-status.enum';

  export class UserResponseDto {
    @ApiProperty({ example: 7 })
    id!: number;

    @ApiProperty({ example: 'user_hoa' })
    username!: string;

    @ApiProperty({ example: 'Nguyễn Thị Hoa' })
    fullName!: string;

    @ApiProperty({ enum: UserRole, example: UserRole.NURSE })
    role!: UserRole;

    @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
    status!: UserStatus;

    @ApiProperty({ example: '2024-06-15T08:00:00.000Z' })
    createdAt!: Date;
  }
