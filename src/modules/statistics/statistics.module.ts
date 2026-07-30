import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../alert/entities/alert.entity';
import { Level } from '../patient/entities/level.entity';
import { OperationType } from '../patient/entities/operation-type.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PodProtocolTrackingLog } from '../patient/entities/pod-protocol-tracking-log.entity';
import { PatientModule } from '../patient/patient.module';
import { AssessmentDetail } from '../symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from '../symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from '../symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from '../symptom-survey/entities/symptom-survey.entity';
import { StatisticsController } from './controllers/statistics.controller';
import { AppEngagementLog } from './entities/app-engagement-log.entity';
import { StatisticsRepository } from './repositories/statistics.repository';
import { StatisticsService } from './services/statistics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Level,
      OperationType,
      Alert,
      AppEngagementLog,
      PodProtocolTrackingLog,
      SymptomSurvey,
      AssessmentDetail,
      SurveyQuestion,
      QuestionOption,
    ]),
    // Reuses PatientRepository (exported by PatientModule) for the per-patient
    // lookups shared with the recovery-matrix / compliance / assessment-matrix
    // endpoints, instead of duplicating the account/level/operationType joins.
    PatientModule,
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}
