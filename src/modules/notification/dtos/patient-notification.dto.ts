import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { PatientNotificationCategory } from '../entities/patient-notification.entity';

export class QueryPatientNotificationDto {
  @ApiPropertyOptional({ enum: ['medical', 'system'], description: 'Lọc theo loại thông báo' })
  @IsOptional()
  @IsIn(['medical', 'system'])
  category?: PatientNotificationCategory;
}

export class PatientNotificationResponseDto {
  @ApiProperty({ example: 1 })
  notificationId!: number;

  @ApiProperty({ example: 'Chế độ ăn đã được cá nhân hóa' })
  title!: string;

  @ApiProperty({
    example: 'Bác sĩ đã chỉ định chế độ ăn riêng cho bạn. Xem hướng dẫn hôm nay ngay.',
  })
  body!: string;

  @ApiProperty({ enum: ['medical', 'system'], example: 'medical' })
  category!: PatientNotificationCategory;

  @ApiPropertyOptional({ example: 'diet_guidance', nullable: true })
  route!: string | null;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ example: '2026-09-26T01:14:00.000Z' })
  createdAt!: Date;
}
