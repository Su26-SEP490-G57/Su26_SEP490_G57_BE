import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  /**
   * Function để extract entity ID từ request
   * - Với POST/PATCH: extract từ response body (vd: response.id, response.caseId)
   * - Với DELETE: extract từ request params (vd: req.params.id)
   */
  getEntityId?: (req: any, res?: any) => string;
  /**
   * Function để extract changes (before/after) từ request body
   * - Chỉ dùng cho UPDATE
   */
  getChanges?: (req: any, res?: any) => { before?: any; after?: any };
}

/**
 * Decorator để đánh dấu endpoint cần audit log
 */
export const AuditLog = (metadata: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, metadata);
