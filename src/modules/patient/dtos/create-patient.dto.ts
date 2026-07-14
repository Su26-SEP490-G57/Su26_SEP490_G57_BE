import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Create a patient = create the clinical `patient_cases` row AND the linked
 * `users` login account (Patient role, users.case_id = patient_cases.case_id).
 *
 * The login credentials are optional: when omitted, the account username
 * defaults to the case id and the password defaults to a system default that
 * the patient/admin can change later via PATCH /users/:id.
 */
export class CreatePatientDto {
  @ApiProperty({
    example: 'CASE-002',
    description: 'Patient case id (primary key)',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  caseId!: string;

  @ApiProperty({
    example: 'Nguyễn Văn B',
    description: "Patient full name (login account's full_name)",
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({
    example: 'CASE-002',
    description: 'Login username for the patient account. Defaults to the case id when omitted.',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    example: 'Patient@123',
    description:
      'Login password. Min 8 chars, 1 uppercase, 1 number, 1 special char. Defaults to "Patient@123" when omitted.',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'password must contain at least 1 uppercase, 1 number, and 1 special character',
  })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: '0901234567', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Tỉnh/Thành phố', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  cityProvince?: string;

  @ApiPropertyOptional({ example: 'Phường Cầu Giấy', description: 'Phường/Xã', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  ward?: string;

  @ApiPropertyOptional({
    example: 'Số 1 Nguyễn Trãi',
    description: 'Địa chỉ chi tiết',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  detailedAddress?: string;

  // ── Clinical / patient_cases ───────────────────────────────────────────────
  @ApiPropertyOptional({ example: 55 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 'Nam', maxLength: 10 })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ example: 170, description: 'Height in cm' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ example: 65, description: 'Weight in kg' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ example: 22.5, description: 'Body Mass Index' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bmi?: number;

  @ApiPropertyOptional({ example: 'Ung thư đại tràng giai đoạn II' })
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'operation_types.operation_type_id (the surgery type lookup)',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  operationTypeId?: number;

  @ApiPropertyOptional({
    example: 'Nội soi',
    description: 'Surgical method/approach',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  method?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the surgery created a GI anastomosis',
  })
  @IsBoolean()
  @IsOptional()
  hasGiAnastomosis?: boolean;

  @ApiPropertyOptional({ example: '2026-06-10', description: 'Surgery date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  surgeryDate?: string;

  @ApiPropertyOptional({ example: 'P101-B1', description: 'Room / bed', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  roomBed?: string;

  @ApiPropertyOptional({ example: 2, description: 'Current post-operative day' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  currentPod?: number;

  @ApiPropertyOptional({ example: 3, description: 'users.user_id of the assigned nurse' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  assignedNurseId?: number;

  @ApiPropertyOptional({ example: 1, description: 'levels.level_id (care/risk level)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  levelId?: number;
}
