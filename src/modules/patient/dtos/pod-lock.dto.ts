import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PodLockDto {
  @ApiProperty({ example: true, description: 'true = lock POD progression, false = unlock' })
  @IsBoolean()
  isLocked!: boolean;

  @ApiPropertyOptional({ example: 'Bệnh nhân chưa dung nạp tốt chế độ ăn hiện tại', description: 'Required when locking' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  holdReason?: string;
}

export class PodLockResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiProperty({ example: true })
  isLocked!: boolean;

  @ApiPropertyOptional({ example: 'Bệnh nhân chưa dung nạp tốt' })
  holdReason!: string | null;
}
