import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SymptomSurveyModule } from '../symptom-survey/symptom-survey.module';
import { PatientController } from './controllers/patient.controller';
import { Level } from './entities/level.entity';
import { OperationType } from './entities/operation-type.entity';
import { Patient } from './entities/patient.entity';
import { PatientGateway } from './gateways/patient.gateway';
import { PatientRepository } from './repositories/patient.repository';
import { ExternalRecordsService } from './services/external-records.service';
import { PatientImportService } from './services/patient-import.service';
import { PatientService } from './services/patient.service';
import { PodSchedulerService } from './services/pod-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Level, OperationType]), SymptomSurveyModule],
  controllers: [PatientController],
  providers: [
    PatientService,
    PatientRepository,
    PatientGateway,
    PodSchedulerService,
    ExternalRecordsService,
    PatientImportService,
  ],
  exports: [PatientService, PatientRepository],
})
export class PatientModule {}
