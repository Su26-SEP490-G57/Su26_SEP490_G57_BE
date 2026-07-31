import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecoveryMatrixLevelDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Red' })
  name!: string;
}

export class RecoveryMatrixOperationTypeDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật đại trực tràng' })
  name!: string;
}

export class RecoveryMilestonesDto {
  @ApiPropertyOptional({ example: 1, nullable: true, description: 'POD day number, or null' })
  timeToRedrink!: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  timeToReeat!: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  podSoftDietReached!: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  timeToFlatus!: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  timeToDefecation!: number | null;
}

export class RecoveryMatrixSummaryDto {
  @ApiPropertyOptional({ example: 5, nullable: true })
  totalPodDays!: number | null;

  @ApiProperty({ example: false })
  isDischarged!: boolean;

  @ApiPropertyOptional({ example: 6, nullable: true })
  lengthOfStay!: number | null;

  @ApiProperty({ example: 1 })
  holdCount!: number;

  @ApiProperty({ example: 0 })
  rollbackCount!: number;

  @ApiProperty({ example: false })
  currentlyOnHold!: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  holdStartedAt!: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastHoldReason!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastHoldAt!: Date | null;

  @ApiProperty({ example: 2 })
  redAlertCount!: number;

  @ApiProperty({ example: 3 })
  yellowAlertCount!: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  giComplications!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  protocolFinalStatus!: string | null;

  @ApiProperty({ example: false })
  erasCompleted!: boolean;
}

export class RecoveryMatrixResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ example: 'P504', nullable: true })
  roomBed!: string | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiPropertyOptional({ type: RecoveryMatrixLevelDto, nullable: true })
  level!: RecoveryMatrixLevelDto | null;

  @ApiPropertyOptional({ type: RecoveryMatrixOperationTypeDto, nullable: true })
  operationType!: RecoveryMatrixOperationTypeDto | null;

  @ApiProperty({ type: RecoveryMilestonesDto })
  milestones!: RecoveryMilestonesDto;

  @ApiProperty({ type: RecoveryMatrixSummaryDto })
  summary!: RecoveryMatrixSummaryDto;
}
