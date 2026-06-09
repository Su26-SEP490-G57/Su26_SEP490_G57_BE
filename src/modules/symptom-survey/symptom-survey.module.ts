import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from '../alert/alert.module';
import { Patient } from '../patient/entities/patient.entity';
import { SymptomSurveyController } from './controllers/symptom-survey.controller';
import { SymptomSurvey } from './entities/symptom-survey.entity';
import { SymptomSurveyRepository } from './repositories/symptom-survey.repository';
import { SymptomSurveyService } from './services/symptom-survey.service';

@Module({
  imports: [TypeOrmModule.forFeature([SymptomSurvey, Patient]), AlertModule],
  controllers: [SymptomSurveyController],
  providers: [SymptomSurveyService, SymptomSurveyRepository],
  exports: [SymptomSurveyService],
})
export class SymptomSurveyModule {}
