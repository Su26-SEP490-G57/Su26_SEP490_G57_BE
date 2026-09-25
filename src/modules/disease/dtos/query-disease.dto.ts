import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryDiseaseDto {
  @ApiPropertyOptional({
    example: 'viem da day',
    description: 'Mã bệnh hoặc tên bệnh (có/không dấu)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export class DiseaseDto {
  @ApiPropertyOptional({ example: 'K25.4' })
  code!: string;

  @ApiPropertyOptional({ example: 'Loét dạ dày, mạn tính hoặc không xác định kèm xuất huyết' })
  name!: string;
}
