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
  optionText!: string;

  @ApiProperty({ example: 1, description: 'Score contributed when this option is selected' })
  @IsInt()
  @Min(0)
  scoreValue!: number;
}

export class UpdateQuestionOptionDto {
  @ApiPropertyOptional({ example: 'Nhẹ' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  optionText?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  scoreValue?: number;
}

export class CreateSurveyQuestionDto {
  @ApiProperty({ example: 'Bạn có buồn nôn không?' })
  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @ApiPropertyOptional({ example: 1, description: 'Display order; lower shows first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNumber?: number;

  @ApiProperty({
    example: false,
    description: 'Whether this is a built-in default question. Must be chosen when creating.',
  })
  @IsBoolean()
  isDefault!: boolean;

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
  questionText?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_number?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNumber?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a built-in default question',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class QuestionOptionDto {
  @ApiProperty({ example: 1 })
  optionId!: number;

  @ApiProperty({ example: 'Nhẹ' })
  optionText!: string;

  @ApiProperty({ example: 1 })
  scoreValue!: number;
}
