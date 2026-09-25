import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertCustomDietGuidanceDto {
  @ApiPropertyOptional({ example: 'Chế độ ăn riêng sau mổ', description: 'Tiêu đề / nhãn' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ example: 4, description: 'Số bữa tối thiểu / ngày' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mealsPerDayMin?: number;

  @ApiPropertyOptional({ example: 6, description: 'Số bữa tối đa / ngày' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mealsPerDayMax?: number;

  @ApiPropertyOptional({ example: 'Chia nhỏ thành các bữa phụ trong ngày' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mealInstruction?: string;

  @ApiPropertyOptional({ example: 50, description: 'Lượng thức ăn tối thiểu mỗi bữa (ml/gam)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  volumePerMealMin?: number;

  @ApiPropertyOptional({ example: 100, description: 'Lượng thức ăn tối đa mỗi bữa (ml/gam)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  volumePerMealMax?: number;

  @ApiPropertyOptional({ example: 'Ăn chậm, nhai kỹ' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  volumeInstruction?: string;

  @ApiPropertyOptional({ example: ['Cháo loãng thịt băm', 'Sữa chua không đường'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedFoods?: string[];

  @ApiPropertyOptional({ example: ['Nước lọc ấm', 'Nước ép táo pha loãng'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedDrinks?: string[];

  @ApiPropertyOptional({ example: ['Đồ chua cay', 'Thịt dai khó tiêu'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenFoods?: string[];

  @ApiPropertyOptional({ example: ['Nước ngọt có gas', 'Cà phê'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenDrinks?: string[];

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường, hạn chế tinh bột đường hấp thu nhanh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  doctorNotes?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Trạng thái kích hoạt áp dụng hướng dẫn riêng này',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DoctorInfoDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'BS. Nguyễn Văn A' })
  fullName!: string;
}

export class CustomDietGuidanceResponseDto {
  @ApiProperty({ example: 1 })
  customDietId!: number;

  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 2 })
  doctorId!: number;

  @ApiPropertyOptional({ type: DoctorInfoDto })
  doctor?: DoctorInfoDto;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'Chế độ ăn chỉ định riêng' })
  label!: string;

  @ApiPropertyOptional({ example: 4 })
  mealsPerDayMin!: number | null;

  @ApiPropertyOptional({ example: 6 })
  mealsPerDayMax!: number | null;

  @ApiPropertyOptional({ example: 'Chia nhỏ thành các bữa phụ trong ngày' })
  mealInstruction!: string | null;

  @ApiPropertyOptional({ example: 50 })
  volumePerMealMin!: number | null;

  @ApiPropertyOptional({ example: 100 })
  volumePerMealMax!: number | null;

  @ApiPropertyOptional({ example: 'Ăn chậm, nhai kỹ' })
  volumeInstruction!: string | null;

  @ApiProperty({ example: ['Cháo loãng'], type: [String] })
  recommendedFoods!: string[];

  @ApiProperty({ example: ['Nước ấm'], type: [String] })
  recommendedDrinks!: string[];

  @ApiProperty({ example: ['Đồ cay nóng'], type: [String] })
  forbiddenFoods!: string[];

  @ApiProperty({ example: ['Nước có gas'], type: [String] })
  forbiddenDrinks!: string[];

  @ApiPropertyOptional({ example: 'Lưu ý kiểm soát đường huyết sau ăn' })
  doctorNotes!: string | null;

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z' })
  updatedAt!: Date | null;

  @ApiProperty({ example: '2026-06-20T00:00:00.000Z' })
  createdAt!: Date;
}

export class PatientCurrentDietGuidanceResponseDto {
  @ApiProperty({
    example: true,
    description:
      'True nếu đây là hướng dẫn ăn riêng của Bác sĩ chỉ định, false nếu là hướng dẫn chung theo POD',
  })
  isCustomized!: boolean;

  @ApiPropertyOptional({ example: 1, description: 'ID hướng dẫn riêng nếu có' })
  customDietId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID phác đồ chung nếu là hướng dẫn chung' })
  podId?: number;

  @ApiProperty({ example: 'Chế độ ăn chỉ định riêng' })
  label!: string;

  @ApiPropertyOptional({ example: 1, description: 'Mức dinh dưỡng hiện tại của ca bệnh' })
  dietLevel?: number;

  @ApiPropertyOptional({ example: 4 })
  mealsPerDayMin!: number | null;

  @ApiPropertyOptional({ example: 6 })
  mealsPerDayMax!: number | null;

  @ApiPropertyOptional({ example: 'Chia nhỏ thành các bữa' })
  mealInstruction!: string | null;

  @ApiPropertyOptional({ example: 50 })
  volumePerMealMin!: number | null;

  @ApiPropertyOptional({ example: 100 })
  volumePerMealMax!: number | null;

  @ApiPropertyOptional({ example: 'Tăng dần theo dung nạp' })
  volumeInstruction!: string | null;

  @ApiProperty({ example: ['Cháo'], type: [String] })
  recommendedFoods!: string[];

  @ApiProperty({ example: ['Nước ấm'], type: [String] })
  recommendedDrinks!: string[];

  @ApiProperty({ example: ['Đồ chiên'], type: [String] })
  forbiddenFoods!: string[];

  @ApiProperty({ example: ['Rượu bia'], type: [String] })
  forbiddenDrinks!: string[];

  @ApiPropertyOptional({ example: ['Không nôn sau ăn'], type: [String] })
  upgradeCriteria?: string[];

  @ApiPropertyOptional({ example: 'Dặn dò đặc biệt từ Bác sĩ' })
  doctorNotes?: string | null;

  @ApiPropertyOptional({ type: DoctorInfoDto })
  prescribedByDoctor?: DoctorInfoDto;

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z' })
  updatedAt!: Date | null;
}
