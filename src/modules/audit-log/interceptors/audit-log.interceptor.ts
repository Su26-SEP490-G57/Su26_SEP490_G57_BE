import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';
import { AuditAction } from '../entities/audit-log.entity';

interface RequestWithUser {
  user?: { id: number };
  ip?: string;
  connection?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

/**
 * Interceptor tự động ghi audit log cho các endpoint được đánh dấu bằng @AuditLog decorator
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditLogMetadata | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    // Nếu endpoint không có @AuditLog decorator, skip
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.id) {
      this.logger.warn('AuditLogInterceptor: No user found in request');
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response: unknown) => {
          void (async () => {
            try {
              const entityId = metadata.getEntityId
                ? metadata.getEntityId(request, response)
                : this.extractDefaultEntityId(response);

              const changes = metadata.getChanges
                ? metadata.getChanges(request, response)
                : undefined;

              await this.auditLogService.log({
                userId: user.id,
                action: metadata.action as AuditAction,
                entityType: metadata.entityType,
                entityId: String(entityId),
                changes,
                ipAddress: request.ip || request.connection?.remoteAddress,
                userAgent: this.extractUserAgent(request.headers),
              });
            } catch (error) {
              // Không throw error để tránh làm gián đoạn business logic
              this.logger.error('Failed to write audit log', error);
            }
          })();
        },
      }),
    );
  }

  private extractDefaultEntityId(response: unknown): string | number {
    if (typeof response === 'object' && response !== null) {
      const respObj = response as Record<string, unknown>;
      const id = respObj.id ?? respObj.caseId;
      if (typeof id === 'string' || typeof id === 'number') {
        return id;
      }
    }
    return 'unknown';
  }

  private extractUserAgent(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const userAgent = headers['user-agent'];
    if (typeof userAgent === 'string') {
      return userAgent;
    }
    if (Array.isArray(userAgent) && userAgent.length > 0) {
      return userAgent[0];
    }
    return undefined;
  }
}
