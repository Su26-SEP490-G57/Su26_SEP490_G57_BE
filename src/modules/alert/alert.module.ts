import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patient/entities/patient.entity';
import { SymptomSurvey } from '../symptom-survey/entities/symptom-survey.entity';
import { AlertController } from './controllers/alert.controller';
import { Alert } from './entities/alert.entity';
import { AlertRepository } from './repositories/alert.repository';
import { AlertService } from './services/alert.service';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, SymptomSurvey, Patient])],
  controllers: [AlertController],
  providers: [AlertService, AlertRepository],
  exports: [AlertService],
})
export class AlertModule {}
