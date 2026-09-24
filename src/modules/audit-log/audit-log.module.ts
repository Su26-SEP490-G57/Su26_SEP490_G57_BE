import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogController } from './controllers/audit-log.controller';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogGateway } from './gateways/audit-log.gateway';
import { UsersModule } from '../user/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), JwtModule.register({}), UsersModule],
  providers: [AuditLogRepository, AuditLogService, AuditLogInterceptor, AuditLogGateway],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
