import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CARE_LEVELS } from '../constants/care-level.constant';
import type { CareLevel } from '../constants/care-level.constant';
import { TreatmentSheetDto, TreatmentSheetInputDto } from './treatment-sheet.dto';

/**
 * Body of `POST /treatment-orders` — the "Phiếu theo dõi điều trị" form.
 *
 * Care Level, "Chỉ định" (`instructions`) and the sheet's clinical fields are
 * required. No order timestamp and no ordering doctor identity: both are
 * server-derived. The sheet itself is stored in the HIS.
 */
export class CreateTreatmentOrderDto {
  @ApiProperty({ example: 'CASE-001' })
  @IsString()
  @IsNotEmpty()
  caseId!: string;

  @ApiProperty({ enum: CARE_LEVELS, example: 'LEVEL_2', description: 'Required care level' })
  @IsIn(CARE_LEVELS)
  careLevel!: CareLevel;

  @ApiProperty({ example: 'Theo dõi sát dấu hiệu sinh tồn mỗi 4 giờ', description: '"Chỉ định"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  instructions!: string;

  @ApiProperty({ type: TreatmentSheetInputDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => TreatmentSheetInputDto)
  sheet!: TreatmentSheetInputDto;
}

/** Body of `PATCH /treatment-orders/:id` — only the currently active order. */
export class UpdateTreatmentOrderDto {
  @ApiPropertyOptional({ enum: CARE_LEVELS, example: 'LEVEL_3' })
  @IsOptional()
  @IsIn(CARE_LEVELS)
  careLevel?: CareLevel;

  @ApiPropertyOptional({ example: 'Giảm tần suất theo dõi xuống mỗi 8 giờ' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string | null;
}

export class TreatmentOrderResponseDto {
  @ApiProperty({ example: 12 })
  treatmentOrderId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ enum: CARE_LEVELS, example: 'LEVEL_2' })
  careLevel!: CareLevel;

  @ApiPropertyOptional({ example: 'Theo dõi sát dấu hiệu sinh tồn', nullable: true })
  instructions!: string | null;

  @ApiPropertyOptional({ example: 8, nullable: true })
  orderedByUserId!: number | null;

  @ApiProperty({ example: 'BS. Trần Văn B' })
  orderedByName!: string;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  orderedAt!: Date;

  @ApiPropertyOptional({ example: '2026-09-20T09:30:00.000Z', nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({
    example: true,
    description: "Whether this order is the patient's currently active one",
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    type: TreatmentSheetDto,
    description: 'The HIS sheet written with this order (create response only)',
  })
  sheet?: TreatmentSheetDto;
}
