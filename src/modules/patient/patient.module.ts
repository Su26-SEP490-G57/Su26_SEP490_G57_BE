import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from './controllers/patient.controller';
import { Level } from './entities/level.entity';
import { OperationType } from './entities/operation-type.entity';
import { Patient } from './entities/patient.entity';
import { PatientGateway } from './gateways/patient.gateway';
import { PatientRepository } from './repositories/patient.repository';
import { PodSchedulerService } from './services/pod-scheduler.service';
import { PatientService } from './services/patient.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Level, OperationType])],
  controllers: [PatientController],
  providers: [PatientService, PatientRepository, PatientGateway, PodSchedulerService],
  exports: [PatientService, PatientRepository],
})
export class PatientModule {}
