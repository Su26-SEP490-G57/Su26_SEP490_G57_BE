import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../entities/audit-log.entity';

export class AuditLogResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 3 })
  userId!: number;

  @ApiProperty({ example: 'nurse01' })
  username!: string;

  @ApiProperty({ example: 'Điều dưỡng 01' })
  userFullName!: string;

  @ApiProperty({ example: 'UPDATE', enum: AuditAction })
  action!: AuditAction;

  @ApiProperty({ example: 'patient_cases' })
  entityType!: string;

  @ApiProperty({ example: 'CASE-001' })
  entityId!: string;

  @ApiProperty({
    example: { before: { dietLevel: 2 }, after: { dietLevel: 3 } },
    nullable: true,
  })
  changes!: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;

  @ApiProperty({ example: '192.168.1.100', nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ example: 'Mozilla/5.0...', nullable: true })
  userAgent!: string | null;

  @ApiProperty({ example: '2026-09-24T14:13:06.039Z' })
  createdAt!: Date;
}

export class PaginatedAuditLogDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data!: AuditLogResponseDto[];

  @ApiProperty({ example: 150 })
  total!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}
