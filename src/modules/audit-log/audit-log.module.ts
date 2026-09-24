import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogController } from './controllers/audit-log.controller';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogGateway } from './gateways/audit-log.gateway';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { UsersModule } from '../user/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    JwtModule.register({}), // For WsJwtGuard token validation
    UsersModule, // For WsJwtGuard user lookup
  ],
  providers: [
    AuditLogRepository,
    AuditLogService,
    AuditLogInterceptor,
    AuditLogGateway,
    WsJwtGuard,
  ],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule implements OnModuleInit {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly auditLogGateway: AuditLogGateway,
  ) {}

  /**
   * Wire up circular dependency: AuditLogService -> AuditLogGateway
   * Cannot inject directly in constructor due to circular reference
   */
  onModuleInit() {
    this.auditLogService.setGateway(this.auditLogGateway);
  }
}
