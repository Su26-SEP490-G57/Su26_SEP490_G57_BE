import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogQueryOptions {
  userId?: number;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async findWithFilters(options: AuditLogQueryOptions): Promise<[AuditLog[], number]> {
    const qb = this.repository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .orderBy('audit_log.createdAt', 'DESC');

    if (options.userId) {
      qb.andWhere('audit_log.userId = :userId', { userId: options.userId });
    }

    if (options.entityType) {
      qb.andWhere('LOWER(audit_log.entityType) LIKE LOWER(:entityType)', {
        entityType: `%${options.entityType}%`,
      });
    }

    if (options.entityId) {
      qb.andWhere('LOWER(audit_log.entityId) LIKE LOWER(:entityId)', {
        entityId: `%${options.entityId}%`,
      });
    }

    if (options.startDate) {
      qb.andWhere('audit_log.createdAt >= :startDate', { startDate: options.startDate });
    }

    if (options.endDate) {
      qb.andWhere('audit_log.createdAt <= :endDate', { endDate: options.endDate });
    }

    if (options.limit) {
      qb.limit(options.limit);
    }

    if (options.offset) {
      qb.offset(options.offset);
    }

    return qb.getManyAndCount();
  }

  create(data: Partial<AuditLog>): AuditLog {
    return this.repository.create(data);
  }

  save(auditLog: AuditLog): Promise<AuditLog> {
    return this.repository.save(auditLog);
  }
}
