import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReassessmentDto {
  @ApiProperty({
    example: 'CASE-001',
    description: 'ID cua ca benh can danh gia lai',
  })
  @IsString()
  @IsNotEmpty()
  caseId!: string;

  @ApiPropertyOptional({
    example: 'GREEN',
    enum: ['GREEN', 'YELLOW', 'RED'],
    description: 'Mau triage moi do dieu duong danh gia (bat buoc voi REASSESSMENT, null voi NOTE)',
  })
  @IsOptional()
  @IsEnum(['GREEN', 'YELLOW', 'RED'])
  triageColor?: 'GREEN' | 'YELLOW' | 'RED';

  @ApiPropertyOptional({
    example: 'Benh nhan on dinh hon, giam buon non sau khi dung thuoc.',
    description: 'Ghi chu lam sang cua dieu duong (toi da 1000 ky tu)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nurseNote?: string;

  @ApiPropertyOptional({
    example: 'REASSESSMENT',
    enum: ['REASSESSMENT', 'NOTE'],
    description:
      'REASSESSMENT = Danh gia lai doi triage color; NOTE = Ghi chu don thuan khong doi triage color',
  })
  @IsOptional()
  @IsEnum(['REASSESSMENT', 'NOTE'])
  source?: 'REASSESSMENT' | 'NOTE';
}
