import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationType } from '../patient/entities/operation-type.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../patient/entities/pod-protocol-tracking-log.entity';
import { SymptomSurvey } from '../symptom-survey/entities/symptom-survey.entity';
import { DietGuidanceController } from './controllers/diet-guidance.controller';
import { PodProtocol } from './entities/pod-protocol.entity';
import { DietGuidanceRepository } from './repositories/diet-guidance.repository';
import { DailyDietProgressionSchedulerService } from './services/daily-diet-progression-scheduler.service';
import { DietGuidanceService } from './services/diet-guidance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PodProtocol,
      OperationType,
      Patient,
      SymptomSurvey,
      PodProtocolTrackingLog,
    ]),
  ],
  controllers: [DietGuidanceController],
  providers: [DietGuidanceService, DietGuidanceRepository, DailyDietProgressionSchedulerService],
  exports: [DietGuidanceService, DailyDietProgressionSchedulerService],
})
export class DietGuidanceModule {}
