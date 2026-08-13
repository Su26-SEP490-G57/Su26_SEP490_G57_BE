import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LevelNames, Levels } from '../constants/levels.constant';

class PatientAccountDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'patient01' })
  username!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiPropertyOptional({ example: '0901234567' })
  phoneNumber!: string | null;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  cityProvince!: string | null;

  @ApiPropertyOptional({ example: 'Phường Cầu Giấy' })
  ward!: string | null;

  @ApiPropertyOptional({ example: 'Số 1 Nguyễn Trãi' })
  detailedAddress!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: ['Patient'], type: [String] })
  roles!: string[];

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  createdAt!: Date;
}

class PatientLevelDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: Levels.RED.levelName, enum: LevelNames })
  name!: string;

  @ApiPropertyOptional({ example: 'High risk - immediate attention required' })
  description!: string | null;
}

class PatientOperationTypeDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật đại trực tràng' })
  name!: string;
}

export class PatientListItemDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  fullName!: string | null;

  @ApiPropertyOptional({ example: 55 })
  age!: number | null;

  @ApiPropertyOptional({ example: 'Nam' })
  gender!: string | null;

  @ApiPropertyOptional({ example: 2 })
  currentPod!: number | null;

  @ApiPropertyOptional({ example: 0 })
  currentDietLevel!: number;

  @ApiPropertyOptional({ type: PatientLevelDto })
  level!: PatientLevelDto | null;

  @ApiPropertyOptional({ type: PatientOperationTypeDto })
  operationType!: PatientOperationTypeDto | null;

  @ApiPropertyOptional({ type: PatientAccountDto })
  account!: PatientAccountDto | null;

  @ApiPropertyOptional({ example: '2026-07-13T14:30:00.000Z' })
  lastAssessmentTime!: Date | null;

  @ApiProperty({
    example: false,
    description:
      'Whether the patient has completed the ERAS protocol (reached max POD with GREEN level)',
  })
  erasCompleted!: boolean;
}

export class PaginatedPatientsDto {
  @ApiProperty({ type: [PatientListItemDto] })
  data!: PatientListItemDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
