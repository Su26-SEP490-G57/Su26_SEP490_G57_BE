import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SymptomSurveyModule } from '../symptom-survey/symptom-survey.module';
import { PodProtocol } from '../diet-guidance/entities/pod-protocol.entity';
import { PatientController } from './controllers/patient.controller';
import { Level } from './entities/level.entity';
import { OperationType } from './entities/operation-type.entity';
import { Patient } from './entities/patient.entity';
import { PodProtocolTrackingLog } from './entities/pod-protocol-tracking-log.entity';
import { PatientGateway } from './gateways/patient.gateway';
import { PatientRepository } from './repositories/patient.repository';
import { PatientService } from './services/patient.service';
import { PodSchedulerService } from './services/pod-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Level, OperationType, PodProtocolTrackingLog, PodProtocol]),
    SymptomSurveyModule,
  ],
  controllers: [PatientController],
  providers: [PatientService, PatientRepository, PatientGateway, PodSchedulerService],
  exports: [PatientService, PatientRepository],
})
export class PatientModule {}
