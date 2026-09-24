import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

// Type-safe interfaces for callback parameters
interface RequestWithBody<T = unknown> {
  body: T;
  params: Record<string, string>;
  [key: string]: unknown;
}

interface ResponseWithData<T = unknown> {
  id?: string | number;
  caseId?: string;
  assessmentId?: number;
  imported?: unknown[];
  skipped?: unknown[];
  failed?: unknown[];
  [key: string]: T;
}

export interface AuditLogMetadata {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  /**
   * Function để extract entity ID từ request
   * - Với POST/PATCH: extract từ response body (vd: response.id, response.caseId)
   * - Với DELETE: extract từ request params (vd: req.params.id)
   */
  getEntityId?: (req: RequestWithBody, res?: ResponseWithData) => string;
  /**
   * Function để extract changes (before/after) từ request body
   * - Chỉ dùng cho UPDATE
   */
  getChanges?: (
    req: RequestWithBody,
    res?: ResponseWithData,
  ) => { before?: unknown; after?: unknown };
}

/**
 * Decorator để đánh dấu endpoint cần audit log
 *
 * @example
 * ```typescript
 * @Patch(':caseId/diet-level')
 * @AuditLog({
 *   action: 'UPDATE',
 *   entityType: 'patient_cases',
 *   getEntityId: (req) => req.params.caseId as string,
 *   getChanges: (req) => ({ after: { dietLevel: req.body.dietLevel, reason: req.body.reason } })
 * })
 * async updateDietLevel(@Param('caseId') caseId: string, @Body() dto: UpdateDietLevelDto) {
 *   // ...
 * }
 * ```
 */
export const AuditLog = (metadata: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, metadata);
