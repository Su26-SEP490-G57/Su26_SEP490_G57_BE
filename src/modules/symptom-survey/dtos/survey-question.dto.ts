import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: 'Nhẹ', description: 'Option label shown to patient' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  option_text!: string;

  @ApiProperty({ example: 1, description: 'Score contributed when this option is selected' })
  @IsInt()
  @Min(0)
  score_value!: number;
}

export class UpdateQuestionOptionDto {
  @ApiPropertyOptional({ example: 'Nhẹ' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  option_text?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  score_value?: number;
}

export class CreateSurveyQuestionDto {
  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  @IsString()
  @IsNotEmpty()
  question_text!: string;

  @ApiPropertyOptional({ example: 1, description: 'Display order; lower shows first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_number?: number;

  @ApiProperty({
    example: false,
    description: 'Whether this is a built-in default question. Must be chosen when creating.',
  })
  @IsBoolean()
  is_default!: boolean;

  @ApiPropertyOptional({
    type: [CreateQuestionOptionDto],
    description: 'Options to create alongside the question',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];
}

export class UpdateSurveyQuestionDto {
  @ApiPropertyOptional({ example: 'Bạn có buồn nôn không? (cập nhật)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question_text?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_number?: number;

  @ApiPropertyOptional({ example: false, description: 'Whether this is a built-in default question' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class QuestionOptionDto {
  @ApiProperty({ example: 1 })
  option_id!: number;

  @ApiProperty({ example: 'Nhẹ' })
  option_text!: string;

  @ApiProperty({ example: 1 })
  score_value!: number;
}
