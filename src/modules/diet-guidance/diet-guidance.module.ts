import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { OperationType } from '../patient/entities/operation-type.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../patient/entities/pod-protocol-tracking-log.entity';
import { SymptomSurvey } from '../symptom-survey/entities/symptom-survey.entity';
import { DietGuidanceController } from './controllers/diet-guidance.controller';
import { PodProtocol } from './entities/pod-protocol.entity';
import { CustomDietGuidance } from './entities/custom-diet-guidance.entity';
import { DietGuidanceRepository } from './repositories/diet-guidance.repository';
import { DailyDietProgressionSchedulerService } from './services/daily-diet-progression-scheduler.service';
import { DietGuidanceService } from './services/diet-guidance.service';
import { AutoCompleteService } from './services/auto-complete.service';
import { AutoCompleteProcessor } from './processors/auto-complete.processor';
import { Alert } from '../alert/entities/alert.entity';
import { AlertRepository } from '../alert/repositories/alert.repository';
import { AlertModule } from '../alert/alert.module';
import { PatientNotificationModule } from '../notification/patient-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PodProtocol,
      CustomDietGuidance,
      OperationType,
      Patient,
      SymptomSurvey,
      PodProtocolTrackingLog,
      Alert,
    ]),
    BullModule.registerQueue({ name: 'auto-complete' }),
    AlertModule,
    PatientNotificationModule,
  ],
  controllers: [DietGuidanceController],
  providers: [
    DietGuidanceService,
    DietGuidanceRepository,
    DailyDietProgressionSchedulerService,
    AutoCompleteService,
    AutoCompleteProcessor,
    AlertRepository,
  ],
  exports: [DietGuidanceService, DailyDietProgressionSchedulerService, AutoCompleteService],
})
export class DietGuidanceModule {}
