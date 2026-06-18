import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from './controllers/patient.controller';
import { Level } from './entities/level.entity';
import { OperationType } from './entities/operation-type.entity';
import { Patient } from './entities/patient.entity';
import { PatientRepository } from './repositories/patient.repository';
import { PatientService } from './services/patient.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Level, OperationType])],
  controllers: [PatientController],
  providers: [PatientService, PatientRepository],
  exports: [PatientService, PatientRepository],
})
export class PatientModule {}
