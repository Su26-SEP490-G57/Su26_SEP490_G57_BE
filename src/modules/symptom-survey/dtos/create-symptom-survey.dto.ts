import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AnswerDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  @IsInt()
  questionId!: number;

  @ApiProperty({ example: 2, description: 'Selected option ID' })
  @IsInt()
  selectedOptionId!: number;
}

export class CreateSymptomSurveyDto {
  @ApiProperty({ example: 'CASE-001', description: 'Patient case ID' })
  @IsString()
  @IsNotEmpty()
  caseId!: string;

  @ApiProperty({ example: 'SCHEDULED', required: false })
  @IsOptional()
  @IsString()
  assessmentType?: 'SCHEDULED' | 'TRIGGERED';

  @ApiProperty({ example: 'MORNING', required: false })
  @IsOptional()
  @IsString()
  scheduledSlot?: 'MORNING' | 'AFTERNOON';

  @ApiProperty({ type: [AnswerDto], description: 'Answers for each survey question' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
