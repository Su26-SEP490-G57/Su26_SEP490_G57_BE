import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CARE_LEVELS } from '../constants/care-level.constant';
import type { CareLevel } from '../constants/care-level.constant';

/**
 * The doctor-written part of a "Phiếu theo dõi điều trị". Every header field
 * (tờ số, cơ sở, khoa, họ tên, tuổi, giới tính, phòng, giường) is re-derived
 * server-side from the patient case — only the clinical fields come from the
 * client. "Chỉ định" is the treatment order's `instructions`.
 */
export class TreatmentSheetInputDto {
  @ApiProperty({ example: '2026-09-23T08:00:00.000Z', description: '"Thời gian" of the exam' })
  @Type(() => Date)
  @IsDate()
  recordedAt!: Date;

  @ApiProperty({ example: 'Mạch 80 l/p, HA 120/80 mmHg...', description: '"Diễn biến bệnh"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  progressNotes!: string;

  @ApiPropertyOptional({ example: 'Ung thư đại tràng phải' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosis?: string;

  /**
   * "Bệnh kèm theo" — same ICD labels as the patient form (`CODE - Name`).
   * Sent = what the doctor chose (an empty array clears it); omitted = the
   * patient's comorbidities.
   */
  @ApiPropertyOptional({ type: [String], example: ['I10 - Tăng huyết áp vô căn'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  comorbidities?: string[];
}

/** A sheet as stored in the HIS (`dummy-his-service` `treatment_sheets`). */
export class TreatmentSheetDto {
  @ApiProperty() sheetId!: number;
  @ApiProperty({ description: '"Tờ số"' }) sheetNumber!: number;
  @ApiProperty() patientCode!: string;
  @ApiProperty() patientName!: string;
  @ApiPropertyOptional({ nullable: true }) facility!: string | null;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiPropertyOptional({ nullable: true }) diagnosis!: string | null;
  @ApiPropertyOptional({ nullable: true }) comorbidities!: string | null;
  @ApiPropertyOptional({ nullable: true }) age!: number | null;
  @ApiPropertyOptional({ nullable: true }) gender!: string | null;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiPropertyOptional({ nullable: true }) bed!: string | null;
  @ApiProperty() recordedAt!: string;
  @ApiProperty() progressNotes!: string;
  @ApiProperty() orders!: string;
  @ApiPropertyOptional({ enum: CARE_LEVELS, nullable: true }) careLevel!: CareLevel | null;
  @ApiPropertyOptional({ nullable: true }) doctorName!: string | null;
  @ApiPropertyOptional({ nullable: true }) externalOrderId!: number | null;
  @ApiProperty() createdAt!: string;
}

/** Everything the form auto-fills, from `GET /treatment-orders/patient/:caseId/sheet-prefill`. */
export class TreatmentSheetPrefillDto {
  @ApiProperty({
    example: 3,
    description: 'Number the next sheet will get (assigned by HIS on save)',
  })
  sheetNumber!: number;

  @ApiProperty({ example: 'Bệnh viện Đa khoa' })
  facility!: string;

  @ApiProperty({ example: 'Khoa Ngoại' })
  department!: string;

  @ApiProperty() caseId!: string;
  @ApiProperty() patientName!: string;
  @ApiPropertyOptional({ nullable: true }) age!: number | null;
  @ApiPropertyOptional({ nullable: true }) gender!: string | null;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiPropertyOptional({ nullable: true }) bed!: string | null;
  @ApiPropertyOptional({ nullable: true }) diagnosis!: string | null;

  @ApiProperty({ type: [String], description: 'Choices for the "Chẩn đoán" dropdown' })
  diagnosisOptions!: string[];

  @ApiProperty({ type: [String], example: ['I10 - Tăng huyết áp vô căn'] })
  comorbidities!: string[];

  @ApiProperty({ description: '"Diễn biến bệnh" seeded from the latest vital signs ("" if none)' })
  progressNotes!: string;

  @ApiPropertyOptional({ nullable: true, description: 'When the latest vital signs were recorded' })
  latestVitalSignAt!: Date | null;

  @ApiPropertyOptional({ enum: CARE_LEVELS, nullable: true })
  activeCareLevel!: CareLevel | null;
}

/** Payload sent to `POST {HIS}/treatment-sheets`. */
export interface HisCreateTreatmentSheet {
  patientCode: string;
  patientName: string;
  facility?: string;
  department?: string;
  diagnosis?: string;
  comorbidities?: string;
  age?: number;
  gender?: string;
  room?: string;
  bed?: string;
  recordedAt: string;
  progressNotes: string;
  orders: string;
  careLevel?: string;
  doctorName?: string;
  externalOrderId?: number;
}
