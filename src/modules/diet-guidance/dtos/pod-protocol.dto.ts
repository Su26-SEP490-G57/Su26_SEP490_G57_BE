import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePodProtocolDto {
  @ApiProperty({ example: '1', description: 'POD label (e.g. 1, 2, 3, Xuất viện)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mealsPerDayMin?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mealsPerDayMax?: number;

  @ApiPropertyOptional({ example: '3 bữa chính, 2-3 bữa phụ' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mealInstruction?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  volumePerMealMin?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  volumePerMealMax?: number;

  @ApiPropertyOptional({ example: 'tăng dần theo dung nạp' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  volumeInstruction?: string;

  @ApiPropertyOptional({ example: 0, description: 'Diet progression level (0 to 4)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dietLevel?: number;

  @ApiPropertyOptional({ example: ['Cháo loãng', 'Súp lọc'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedFoods?: string[];

  @ApiPropertyOptional({ example: ['Nước ấm', 'Nước điện giải'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedDrinks?: string[];

  @ApiPropertyOptional({ example: ['Đồ chiên rán', 'Đồ cay nóng'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenFoods?: string[];

  @ApiPropertyOptional({ example: ['Nước có ga', 'Rượu bia'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenDrinks?: string[];

  @ApiPropertyOptional({
    example: ['Hoàn thành ≥75% mục tiêu khẩu phần hiện tại', 'Không nôn'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  upgradeCriteria?: string[];
}

export class UpdatePodProtocolDto extends CreatePodProtocolDto {
  @ApiPropertyOptional({ example: '1' })
  declare label: string;
}

export class PodProtocolResponseDto {
  @ApiProperty({ example: 1 })
  podId!: number;

  @ApiProperty({ example: 1 })
  operationTypeId!: number;

  @ApiProperty({ example: '1' })
  label!: string;

  @ApiProperty({ example: 0 })
  dietLevel!: number;

  @ApiPropertyOptional({ example: 6 })
  mealsPerDayMin!: number | null;

  @ApiPropertyOptional({ example: 8 })
  mealsPerDayMax!: number | null;

  @ApiPropertyOptional({ example: null })
  mealInstruction!: string | null;

  @ApiPropertyOptional({ example: 30 })
  volumePerMealMin!: number | null;

  @ApiPropertyOptional({ example: 50 })
  volumePerMealMax!: number | null;

  @ApiPropertyOptional({ example: 'tăng dần theo dung nạp' })
  volumeInstruction!: string | null;

  @ApiProperty({ example: ['Cháo loãng', 'Súp lọc'], type: [String] })
  recommendedFoods!: string[];

  @ApiProperty({ example: ['Nước ấm', 'Nước điện giải'], type: [String] })
  recommendedDrinks!: string[];

  @ApiProperty({ example: ['Đồ chiên rán'], type: [String] })
  forbiddenFoods!: string[];

  @ApiProperty({ example: ['Nước có ga'], type: [String] })
  forbiddenDrinks!: string[];

  @ApiProperty({ example: ['Không nôn'], type: [String] })
  upgradeCriteria!: string[];

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z' })
  updatedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z' })
  createdAt!: Date;
}
