import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patient/entities/patient.entity';
import { SymptomSurvey } from '../symptom-survey/entities/symptom-survey.entity';
import { RoomNurseAssignmentController } from './controllers/room-nurse-assignment.controller';
import { RoomNurseAssignmentRepository } from './repositories/room-nurse-assignment.repository';
import { AlertController } from './controllers/alert.controller';
import { RoomNurseAssignment } from './entities/room-nurse-assignment.entity';
import { Alert } from './entities/alert.entity';
import { AlertGateway } from './gateways/alert.gateway';
import { AlertRepository } from './repositories/alert.repository';
import { AlertService } from './services/alert.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { NotificationService } from './services/notification.service';
import { PatientReminderSchedulerService } from './services/patient-reminder.scheduler';
import { PatientRepository } from '../patient/repositories/patient.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, SymptomSurvey, Patient, RoomNurseAssignment]),
    FirebaseModule,
  ],
  controllers: [AlertController, RoomNurseAssignmentController],
  providers: [
    AlertService,
    AlertRepository,
    RoomNurseAssignmentRepository,
    PatientRepository,
    AlertGateway,
    NotificationService,
    PatientReminderSchedulerService,
  ],
  exports: [AlertService, NotificationService],
})
export class AlertModule {}
