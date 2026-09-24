import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { AuditLogService } from '../services/audit-log.service';
import { QueryAuditLogDto } from '../dtos/query-audit-log.dto';
import { AuditLogResponseDto, PaginatedAuditLogDto } from '../dtos/audit-log-response.dto';
import { AuditLog } from '../entities/audit-log.entity';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(UserRoleName.ADMIN)
  @ApiOperation({
    summary: 'Get audit logs (ADMIN only)',
    description:
      'Truy xuất lịch sử thay đổi dữ liệu trong hệ thống. ' +
      'Ghi lại: Ai (user)? Làm gì (action)? Thay đổi gì (changes)? Khi nào (timestamp)?',
  })
  @ApiResponse({ status: 200, type: PaginatedAuditLogDto })
  async getAuditLogs(@Query() query: QueryAuditLogDto): Promise<PaginatedAuditLogDto> {
    const { data, total } = await this.auditLogService.findLogs({
      userId: query.userId,
      entityType: query.entityType,
      entityId: query.entityId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      data: data.map((log) => this.mapToDto(log)),
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  private mapToDto(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      userId: log.userId,
      username: log.user?.username ?? 'Unknown',
      userFullName: log.user?.fullName ?? 'Unknown User',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }
}
