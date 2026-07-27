import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * One surgical record selected in the HIS import popup. Shape mirrors the HIS
 * response (see ExternalSurgicalRecordDto); the head nurse ticks the records to
 * import and the frontend posts them here.
 */
export class ImportSurgicalRecordDto {
  @ApiProperty({ example: 'HIS-REC-01' })
  @IsString()
  @IsNotEmpty()
  recordId!: string;

  @ApiProperty({
    example: 'HIS-100000',
    description: 'Becomes the patient case id / login username',
  })
  @IsString()
  @IsNotEmpty()
  hospitalPatientCode!: string;

  @ApiProperty({ example: 'N.V.A' })
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @ApiPropertyOptional({ example: '1975-04-12' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: 'M' })
  @IsString()
  @IsOptional()
  sex?: string | null;

  @ApiPropertyOptional({ example: 168 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  heightCm?: number | null;

  @ApiPropertyOptional({ example: 62.5 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weightKg?: number | null;

  @ApiPropertyOptional({ example: 'Carcinoma of the sigmoid colon' })
  @IsString()
  @IsOptional()
  admissionDiagnosis?: string | null;

  @ApiProperty({ example: 'Laparoscopic anterior resection' })
  @IsString()
  @IsNotEmpty()
  procedureName!: string;

  @ApiPropertyOptional({ example: '48.63' })
  @IsString()
  @IsOptional()
  procedureCode?: string | null;

  @ApiPropertyOptional({ example: 'LAPAROSCOPIC' })
  @IsString()
  @IsOptional()
  surgicalApproach?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  bowelAnastomosis?: boolean | null;

  @ApiPropertyOptional({ example: '2026-07-01T08:30:00.000Z' })
  @IsString()
  @IsOptional()
  operatedAt?: string | null;

  @ApiPropertyOptional({ example: 'Dr. Tran Van B' })
  @IsString()
  @IsOptional()
  attendingSurgeon?: string | null;

  @ApiPropertyOptional({ example: 'GI-2' })
  @IsString()
  @IsOptional()
  wardCode?: string | null;

  @ApiPropertyOptional({ example: 'B-14' })
  @IsString()
  @IsOptional()
  bedNumber?: string | null;

  @ApiPropertyOptional({ example: 'IN_HOSPITAL' })
  @IsString()
  @IsOptional()
  dischargeStatus?: string | null;

  @ApiPropertyOptional({ example: '+84901234567' })
  @IsString()
  @IsOptional()
  contactPhone?: string | null;
}

/** Payload for POST /patients/import — the records the head nurse selected. */
export class ImportPatientsDto {
  @ApiProperty({ type: [ImportSurgicalRecordDto], description: 'Selected HIS records to import' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ImportSurgicalRecordDto)
  records!: ImportSurgicalRecordDto[];
}

export type ImportStatus = 'imported' | 'skipped' | 'failed';

/** Per-record outcome of the import. */
export class ImportResultItemDto {
  @ApiProperty({ example: 'HIS-REC-01' })
  recordId!: string;

  @ApiProperty({ example: 'HIS-100000', nullable: true })
  caseId!: string | null;

  @ApiProperty({ example: 'imported', enum: ['imported', 'skipped', 'failed'] })
  status!: ImportStatus;

  @ApiProperty({ example: true, description: 'Whether ERAS was started for this patient' })
  erasStarted!: boolean;

  @ApiProperty({ example: null, nullable: true, description: 'Reason when skipped/failed' })
  message!: string | null;
}

/** Summary returned by POST /patients/import. */
export class ImportPatientsResultDto {
  @ApiProperty({ example: 5 })
  total!: number;

  @ApiProperty({ example: 4 })
  imported!: number;

  @ApiProperty({ example: 1 })
  skipped!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ type: [ImportResultItemDto] })
  results!: ImportResultItemDto[];
}
