import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from '../alert/alert.module';
import { Level } from '../patient/entities/level.entity';
import { Patient } from '../patient/entities/patient.entity';
import { StatisticsGatewayModule } from '../statistics/statistics-gateway.module';
import { SymptomSurveyController } from './controllers/symptom-survey.controller';
import { AssessmentDetail } from './entities/assessment-detail.entity';
import { AssessmentTask } from './entities/assessment-task.entity';
import { QuestionOption } from './entities/question-option.entity';
import { SurveyQuestion } from './entities/survey-question.entity';
import { SymptomSurvey } from './entities/symptom-survey.entity';
import { SymptomSurveyRepository } from './repositories/symptom-survey.repository';
import { AssessmentTaskRepository } from './repositories/assessment-task.repository';
import { SymptomSurveyService } from './services/symptom-survey.service';
import { AssessmentTaskSchedulerService } from './services/assessment-task-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SymptomSurvey,
      AssessmentDetail,
      AssessmentTask,
      SurveyQuestion,
      QuestionOption,
      Patient,
      Level,
    ]),
    AlertModule,
    StatisticsGatewayModule,
  ],
  controllers: [SymptomSurveyController],
  providers: [
    SymptomSurveyService,
    SymptomSurveyRepository,
    AssessmentTaskRepository,
    AssessmentTaskSchedulerService,
  ],
  exports: [SymptomSurveyService],
})
export class SymptomSurveyModule {}
