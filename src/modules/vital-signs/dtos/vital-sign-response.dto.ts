import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VitalSignResponseDto {
  @ApiProperty({ example: 42 })
  vitalSignId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 78 })
  pulseBpm!: number;

  @ApiProperty({ example: 120 })
  bloodPressureSystolic!: number;

  @ApiProperty({ example: 80 })
  bloodPressureDiastolic!: number;

  @ApiProperty({ example: 36.8 })
  temperatureCelsius!: number;

  @ApiProperty({ example: 18 })
  respiratoryRate!: number;

  @ApiProperty({ example: 98 })
  spo2Percent!: number;

  @ApiPropertyOptional({ example: 'Bệnh nhân tỉnh táo', nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  recordedByUserId!: number | null;

  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  recordedByName!: string;

  @ApiProperty({ example: '2026-09-20T08:15:00.000Z' })
  recordedAt!: Date;
}

export class PaginatedVitalSignsDto {
  @ApiProperty({ type: [VitalSignResponseDto] })
  data!: VitalSignResponseDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
