import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from '../alert/alert.module';
import { Patient } from '../patient/entities/patient.entity';
import { SymptomSurveyController } from './controllers/symptom-survey.controller';
import { AssessmentDetail } from './entities/assessment-detail.entity';
import { QuestionOption } from './entities/question-option.entity';
import { SurveyQuestion } from './entities/survey-question.entity';
import { SymptomSurvey } from './entities/symptom-survey.entity';
import { SymptomSurveyRepository } from './repositories/symptom-survey.repository';
import { SymptomSurveyService } from './services/symptom-survey.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SymptomSurvey, AssessmentDetail, SurveyQuestion, QuestionOption, Patient]),
    AlertModule,
  ],
  controllers: [SymptomSurveyController],
  providers: [SymptomSurveyService, SymptomSurveyRepository],
  exports: [SymptomSurveyService],
})
export class SymptomSurveyModule {}
