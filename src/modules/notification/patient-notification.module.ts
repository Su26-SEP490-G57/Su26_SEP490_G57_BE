import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientNotification } from './entities/patient-notification.entity';
import { PatientNotificationController } from './controllers/patient-notification.controller';
import { PatientNotificationRepository } from './repositories/patient-notification.repository';
import { PatientNotificationService } from './services/patient-notification.service';
import { StatisticsGatewayModule } from '../statistics/statistics-gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([PatientNotification]), StatisticsGatewayModule],
  controllers: [PatientNotificationController],
  providers: [PatientNotificationService, PatientNotificationRepository],
  exports: [PatientNotificationService],
})
export class PatientNotificationModule {}
