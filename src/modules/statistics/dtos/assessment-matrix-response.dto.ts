import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssessmentMatrixCellDto {
  @ApiProperty({ example: 2 })
  pod!: number;

  @ApiProperty({ example: true })
  submitted!: boolean;

  @ApiPropertyOptional({ example: 1, nullable: true })
  score!: number | null;

  @ApiPropertyOptional({ example: 'Thỉnh thoảng', nullable: true })
  optionText!: string | null;
}

export class AssessmentMatrixQuestionDto {
  @ApiProperty({ example: 3 })
  questionId!: number;

  @ApiProperty({ example: 'Bạn có chướng bụng không?' })
  questionText!: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  orderNumber!: number | null;

  @ApiProperty({ type: [AssessmentMatrixCellDto] })
  cells!: AssessmentMatrixCellDto[];
}

export class AssessmentMatrixResponseDto {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiProperty({ example: [0, 1, 2, 3], type: [Number] })
  pods!: number[];

  @ApiProperty({ type: [AssessmentMatrixQuestionDto] })
  questions!: AssessmentMatrixQuestionDto[];

  @ApiProperty({
    example: 0,
    description: 'Assessments with pod_context IS NULL (excluded from the grid)',
  })
  unassignedAssessmentCount!: number;
}
