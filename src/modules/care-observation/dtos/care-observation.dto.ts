import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CARE_LEVELS } from '../../treatment-order/constants/care-level.constant';
import type { CareLevel } from '../../treatment-order/constants/care-level.constant';
import type { CareObservationChecklistItem } from '../entities/care-observation-sheet-template.entity';
import { CARE_OBSERVATION_TASK_STATUSES } from '../entities/care-observation-task.entity';
import type { CareObservationTaskStatus } from '../entities/care-observation-task.entity';

/**
 * Body of `POST /care-observation/tasks/:taskId/entries`.
 *
 * Contains no observer identity and no timestamp — both are server-derived.
 */
export class CreateCareObservationEntryDto {
  @ApiProperty({
    description: "Findings keyed by the template's checklistItems[].key",
    example: { painAssessment: 3, woundDressingCheck: true, mobility: 'Ngồi dậy tại giường' },
  })
  @IsObject()
  findings!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Bệnh nhân hợp tác tốt' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CareObservationTemplateDto {
  @ApiProperty({ example: 2 })
  templateId!: number;

  @ApiProperty({ example: 'LEVEL_2_3_SHEET' })
  code!: string;

  @ApiProperty({ example: 'Phiếu theo dõi chăm sóc cấp 2-3' })
  name!: string;

  @ApiProperty({
    description: 'Checklist rows rendered generically by the FE',
    example: [{ key: 'painAssessment', label: 'Đánh giá đau (0-10)', inputType: 'number' }],
  })
  checklistItems!: CareObservationChecklistItem[];
}

export class CareObservationEntryResponseDto {
  @ApiProperty({ example: 17 })
  entryId!: number;

  @ApiProperty({ example: 4 })
  taskId!: number;

  @ApiProperty({ example: { painAssessment: 3 } })
  findings!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Bệnh nhân hợp tác tốt', nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  observedByUserId!: number | null;

  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  observedByName!: string;

  @ApiProperty({ example: '2026-09-20T08:15:00.000Z' })
  observedAt!: Date;
}

export class CareObservationTaskResponseDto {
  @ApiProperty({ example: 4 })
  taskId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 12, nullable: true })
  treatmentOrderId!: number | null;

  @ApiProperty({ enum: CARE_LEVELS, example: 'LEVEL_2' })
  careLevelAtAssignment!: CareLevel;

  @ApiProperty({ enum: CARE_OBSERVATION_TASK_STATUSES, example: 'OPEN' })
  status!: CareObservationTaskStatus;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  supersededAt!: Date | null;

  @ApiProperty({ type: CareObservationTemplateDto })
  template!: CareObservationTemplateDto;
}

export class CareObservationTaskDetailDto extends CareObservationTaskResponseDto {
  @ApiProperty({ type: [CareObservationEntryResponseDto] })
  entries!: CareObservationEntryResponseDto[];
}
