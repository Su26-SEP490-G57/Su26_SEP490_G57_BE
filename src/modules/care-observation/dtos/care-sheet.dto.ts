import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CARE_LEVELS } from '../../treatment-order/constants/care-level.constant';
import type { CareLevel } from '../../treatment-order/constants/care-level.constant';
import { CARE_SHEET_TYPES } from '../constants/care-sheet-form.constant';
import type { CareSheetSection, CareSheetType } from '../constants/care-sheet-form.constant';

/**
 * Body of `POST /care-observation/patient/:caseId/sheets`.
 *
 * The header (tờ số, cơ sở, khoa, họ tên, tuổi, giới tính, phòng, giường,
 * chẩn đoán, phân cấp chăm sóc, loại phiếu, điều dưỡng) is derived
 * server-side. `content` keys must come from the served form layout.
 */
export class CreateCareSheetDto {
  @ApiProperty({ example: '2026-09-23T08:00:00.000Z', description: '"Ngày" + "Giờ"' })
  @Type(() => Date)
  @IsDate()
  recordedAt!: Date;

  @ApiPropertyOptional({ example: 'VV-2026-00123', description: '"Số vào viện"' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  admissionNumber?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: '"Tiền sử dị ứng": true = có, false = chưa ghi nhận',
  })
  @IsOptional()
  @IsBoolean()
  hasAllergy?: boolean;

  @ApiPropertyOptional({ example: 'Penicillin', description: '"Có, ghi rõ"' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergyNote?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'chiSo.mach': '82', 'toanThan.triGiac': 'Tỉnh' },
  })
  @IsObject()
  content!: Record<string, string>;
}

/** A care sheet as stored in the HIS (`dummy-his-service` `care_sheets`). */
export class CareSheetDto {
  @ApiProperty() sheetId!: number;
  @ApiProperty({ description: '"Tờ số"' }) sheetNumber!: number;
  @ApiProperty({ enum: CARE_SHEET_TYPES }) sheetType!: CareSheetType;
  @ApiPropertyOptional({ enum: CARE_LEVELS, nullable: true }) careLevel!: CareLevel | null;
  @ApiProperty() patientCode!: string;
  @ApiProperty() patientName!: string;
  @ApiPropertyOptional({ nullable: true }) facility!: string | null;
  @ApiPropertyOptional({ nullable: true }) department!: string | null;
  @ApiPropertyOptional({ nullable: true }) admissionNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) age!: number | null;
  @ApiPropertyOptional({ nullable: true }) gender!: string | null;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiPropertyOptional({ nullable: true }) bed!: string | null;
  @ApiPropertyOptional({ nullable: true }) diagnosis!: string | null;
  @ApiPropertyOptional({ nullable: true }) hasAllergy!: boolean | null;
  @ApiPropertyOptional({ nullable: true }) allergyNote!: string | null;
  @ApiProperty() recordedAt!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  content!: Record<string, string>;
  @ApiPropertyOptional({ nullable: true }) nurseName!: string | null;
  @ApiProperty() createdAt!: string;
}

export class CareSheetFormDto {
  @ApiProperty({ example: '38/BV1' }) formCode!: string;
  @ApiProperty() legend!: string;
  @ApiProperty({ description: 'Sections in paper-form order' }) sections!: CareSheetSection[];
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  titles!: Record<CareSheetType, string>;
}

/** Response of `GET /care-observation/patient/:caseId/sheets`. */
export class CareSheetListDto {
  @ApiProperty({ type: [CareSheetDto] }) sheets!: CareSheetDto[];

  @ApiProperty({ description: 'Form layout used to render `content`' })
  form!: CareSheetFormDto;
}

/** Everything the care-sheet form auto-fills. */
export class CareSheetPrefillDto {
  @ApiPropertyOptional({
    enum: CARE_SHEET_TYPES,
    nullable: true,
    description: 'Sheet the doctor-ordered care level calls for; null = no care level ordered yet',
  })
  sheetType!: CareSheetType | null;

  @ApiPropertyOptional({ enum: CARE_LEVELS, nullable: true, description: '"Phân cấp chăm sóc"' })
  careLevel!: CareLevel | null;

  @ApiProperty({ description: 'Number the next sheet will get (assigned by HIS on save)' })
  sheetNumber!: number;

  @ApiProperty() facility!: string;
  @ApiProperty() department!: string;
  @ApiProperty() caseId!: string;
  @ApiProperty() patientName!: string;
  @ApiPropertyOptional({ nullable: true }) age!: number | null;
  @ApiPropertyOptional({ nullable: true }) gender!: string | null;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiPropertyOptional({ nullable: true }) bed!: string | null;
  @ApiPropertyOptional({ nullable: true }) diagnosis!: string | null;

  @ApiProperty({ description: '"Tên điều dưỡng thực hiện" — the caller' })
  nurseName!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Pre-filled content: latest vital signs, weight, BMI',
  })
  content!: Record<string, string>;

  @ApiPropertyOptional({ nullable: true }) latestVitalSignAt!: Date | null;

  @ApiProperty({ type: CareSheetFormDto }) form!: CareSheetFormDto;
}

/** Payload sent to `POST {HIS}/care-sheets`. */
export interface HisCreateCareSheet {
  sheetType: CareSheetType;
  careLevel?: string;
  patientCode: string;
  patientName: string;
  facility?: string;
  department?: string;
  admissionNumber?: string;
  age?: number;
  gender?: string;
  room?: string;
  bed?: string;
  diagnosis?: string;
  hasAllergy?: boolean;
  allergyNote?: string;
  recordedAt: string;
  content: Record<string, string>;
  nurseName?: string;
}
