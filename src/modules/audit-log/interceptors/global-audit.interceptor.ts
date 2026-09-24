import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';

/**
 * Global interceptor tự động ghi audit log cho MỌI endpoint mutation (POST/PATCH/PUT/DELETE).
 *
 * **Behavior**:
 * - Tự động detect HTTP method → map sang AuditAction
 * - Extract entityType từ request path (ví dụ: /api/patients/:id → "patients")
 * - Extract entityId từ params hoặc response body
 * - Skip read-only endpoints (GET, HEAD, OPTIONS)
 * - Skip health check và internal endpoints
 *
 * **Override**: Nếu endpoint có @AuditLog decorator, dùng metadata đó thay vì auto-detect
 * (AuditLogInterceptor sẽ handle trước vì được apply bởi decorator, chạy sau global này)
 *
 * **Trade-off**:
 * - ✅ Zero-maintenance: mọi endpoint mới tự động có audit
 * - ⚠️ Less precise: entityType/entityId là best-effort guess
 * - ⚠️ Có thể log quá nhiều (ví dụ: public endpoints) → cần SKIP_AUDIT decorator cho exceptions
 */
const SKIP_AUDIT_KEY = 'skip_audit';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

@Injectable()
export class GlobalAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GlobalAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      user?: { id: number };
      params: Record<string, string>;
      body: Record<string, unknown>;
      ip?: string;
      connection?: { remoteAddress?: string };
      headers: Record<string, string>;
    }>();

    // Skip if endpoint has @SkipAudit decorator
    const skipAudit = this.reflector.get<boolean>(SKIP_AUDIT_KEY, context.getHandler());
    if (skipAudit) {
      return next.handle();
    }

    // Skip read-only methods
    const method = request.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    // Skip health check, metrics, internal endpoints
    if (
      request.path.includes('/health') ||
      request.path.includes('/metrics') ||
      request.path.includes('/auth/refresh') || // Token refresh không cần audit
      request.path.includes('/firebase/token') // FCM token registration không cần audit
    ) {
      return next.handle();
    }

    // Skip if no authenticated user (public endpoints)
    const user = request.user;
    if (!user?.id) {
      return next.handle();
    }

    // Map HTTP method to AuditAction
    const actionMap: Record<string, AuditAction> = {
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };
    const action = actionMap[method];
    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response: unknown) => {
          // Use void to explicitly ignore the promise (fire-and-forget)
          void (async () => {
            try {
              // Extract entityType từ request path
              // Ví dụ: /api/patients/123/assessments → "assessments"
              //        /api/alerts/456 → "alerts"
              const pathSegments = request.path.split('/').filter((s) => s && !s.match(/^\d+$/));
              const entityType = pathSegments[pathSegments.length - 1] || 'unknown';

              // Extract entityId: params.id > params[...] > response.id > "bulk"
              let entityId = 'unknown';
              if (request.params.id) {
                entityId = request.params.id;
              } else if (request.params.caseId) {
                entityId = request.params.caseId;
              } else if (request.params.assessmentId) {
                entityId = request.params.assessmentId;
              } else if (typeof response === 'object' && response !== null) {
                const respObj = response as Record<string, unknown>;
                const rawId = respObj.id ?? respObj.caseId ?? respObj.alertId;
                // Only stringify if rawId is primitive (string/number), otherwise use 'bulk'
                if (typeof rawId === 'string' || typeof rawId === 'number') {
                  entityId = String(rawId);
                } else {
                  entityId = 'bulk';
                }
              }

              // Capture changes (simplified — chỉ log request body cho UPDATE/CREATE)
              let changes:
                | { before?: Record<string, unknown>; after?: Record<string, unknown> }
                | undefined;
              if (action === AuditAction.UPDATE) {
                changes = {
                  after: request.body,
                  // before: undefined — would need to fetch from DB, skip for now
                };
              } else if (action === AuditAction.CREATE) {
                changes = {
                  after: request.body,
                };
              }

              await this.auditLogService.log({
                userId: user.id,
                action,
                entityType,
                entityId: String(entityId),
                changes,
                ipAddress: request.ip || request.connection?.remoteAddress,
                userAgent: request.headers['user-agent'],
              });
            } catch (error) {
              // Non-blocking: log error nhưng không throw
              this.logger.error(
                `Failed to write global audit log for ${request.method} ${request.path}`,
                error,
              );
            }
          })();
        },
        error: () => {
          // Không audit failed requests (business logic rejected)
          // Nếu cần track failures, có thể log với action = 'FAILED_ATTEMPT'
        },
      }),
    );
  }
}
