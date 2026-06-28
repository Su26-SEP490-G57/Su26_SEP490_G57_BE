import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class AnswerDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  @IsInt()
  question_id!: number;

  @ApiProperty({ example: 2, description: 'Selected option ID' })
  @IsInt()
  selected_option_id!: number;
}

export class CreateSymptomSurveyDto {
  @ApiProperty({ example: 'CASE-001', description: 'Patient case ID' })
  @IsString()
  @IsNotEmpty()
  case_id!: string;

  @ApiProperty({ type: [AnswerDto], description: 'Answers for each survey question' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
