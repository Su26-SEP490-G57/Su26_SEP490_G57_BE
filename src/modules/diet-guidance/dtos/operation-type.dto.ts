import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOperationTypeDto {
  @ApiProperty({ example: 'Phẫu thuật dạ dày' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Áp dụng cho các ca phẫu thuật dạ dày' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateOperationTypeDto {
  @ApiPropertyOptional({ example: 'Phẫu thuật dạ dày (cập nhật)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả cập nhật' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class OperationTypeResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật dạ dày' })
  name!: string;

  @ApiPropertyOptional({ example: 'Áp dụng cho...' })
  description!: string | null;

  @ApiProperty({ example: 3, description: 'Số POD đã có' })
  podCount!: number;
}
