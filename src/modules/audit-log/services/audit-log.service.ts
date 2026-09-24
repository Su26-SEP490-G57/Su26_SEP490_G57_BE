import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditLog } from '../entities/audit-log.entity';
import { AuditLogRepository, AuditLogQueryOptions } from '../repositories/audit-log.repository';
import { AuditLogGateway } from '../gateways/audit-log.gateway';

export interface CreateAuditLogDto {
  userId: number;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly gateway: AuditLogGateway,
  ) {}

  /**
   * Ghi log một hành động của user
   * **Side effect**: Broadcasts to connected admin clients via WebSocket
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      userId: dto.userId,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      changes: dto.changes ?? null,
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
    });

    const savedLog = await this.auditLogRepository.save(auditLog);

    // Broadcast realtime - đơn giản, không try/catch
    this.gateway.emitNewLog(savedLog);

    return savedLog;
  }

  /**
   * Lấy danh sách audit logs với filter
   */
  async findLogs(options: AuditLogQueryOptions): Promise<{ data: AuditLog[]; total: number }> {
    const [data, total] = await this.auditLogRepository.findWithFilters(options);
    return { data, total };
  }

  /**
   * Lấy audit logs cho một entity cụ thể (ví dụ: lịch sử thay đổi của 1 patient)
   */
  async getEntityHistory(entityType: string, entityId: string): Promise<AuditLog[]> {
    const [logs] = await this.auditLogRepository.findWithFilters({
      entityType,
      entityId,
      limit: 100,
    });
    return logs;
  }
}
