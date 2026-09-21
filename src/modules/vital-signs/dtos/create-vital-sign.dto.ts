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
 * Pulse/SpO2/temperature keep engineering sanity limits (applied identically
 * on the FE — not clinical thresholds, to be revisited with a clinician).
 * Blood pressure and respiratory rate have NO min/max by request — only
 * "must be a whole number" is still enforced.
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

  @ApiProperty({ example: 120, description: 'Systolic BP (mmHg)' })
  @Type(() => Number)
  @IsInt()
  bloodPressureSystolic!: number;

  @ApiProperty({ example: 80, description: 'Diastolic BP (mmHg)' })
  @Type(() => Number)
  @IsInt()
  bloodPressureDiastolic!: number;

  @ApiProperty({ example: 36.85, minimum: 30, maximum: 43, description: 'Temperature (°C)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(30)
  @Max(43)
  temperatureCelsius!: number;

  @ApiProperty({ example: 18, description: 'Respiratory rate (/min)' })
  @Type(() => Number)
  @IsInt()
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
