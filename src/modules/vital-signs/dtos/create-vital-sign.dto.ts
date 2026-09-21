import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body of `POST /vital-signs`.
 *
 * Deliberately contains NO timestamp and NO recorder identity: `recordedAt`,
 * `recordedByUserId` and `recordedByName` are always derived server-side from
 * the authenticated user and the server clock.
 *
 * The numeric bounds are engineering sanity limits, applied identically on the
 * FE — not clinical thresholds (to be revisited with a clinician).
 */
export class CreateVitalSignDto {
  @ApiProperty({ example: 'CASE-001' })
  @IsString()
  @IsNotEmpty()
  caseId!: string;

  @ApiProperty({ example: 78, minimum: 30, maximum: 220, description: 'Pulse (bpm)' })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(220)
  pulseBpm!: number;

  @ApiProperty({ example: 120, minimum: 60, maximum: 250, description: 'Systolic BP (mmHg)' })
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(250)
  bloodPressureSystolic!: number;

  @ApiProperty({ example: 80, minimum: 30, maximum: 150, description: 'Diastolic BP (mmHg)' })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(150)
  bloodPressureDiastolic!: number;

  @ApiProperty({ example: 36.8, minimum: 30, maximum: 43, description: 'Temperature (°C)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(43)
  temperatureCelsius!: number;

  @ApiProperty({ example: 18, minimum: 4, maximum: 60, description: 'Respiratory rate (/min)' })
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(60)
  respiratoryRate!: number;

  @ApiProperty({ example: 98, minimum: 0, maximum: 100, description: 'SpO2 (%)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  spo2Percent!: number;

  @ApiPropertyOptional({ example: 'Bệnh nhân tỉnh táo, không đau ngực' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
