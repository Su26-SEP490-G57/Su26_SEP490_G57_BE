import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HisModule } from '../his/his.module';
import { Patient } from '../patient/entities/patient.entity';
import { PatientNotificationModule } from '../notification/patient-notification.module';
import { HisCareSheetClient } from './clients/his-care-sheet.client';
import { CareObservationController } from './controllers/care-observation.controller';
import { CareObservationEntry } from './entities/care-observation-entry.entity';
import { CareObservationSheetTemplate } from './entities/care-observation-sheet-template.entity';
import { CareObservationTask } from './entities/care-observation-task.entity';
import { CareObservationRepository } from './repositories/care-observation.repository';
import { CareObservationService } from './services/care-observation.service';
import { CareSheetService } from './services/care-sheet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CareObservationSheetTemplate,
      CareObservationTask,
      CareObservationEntry,
      Patient,
    ]),
    HisModule,
    PatientNotificationModule,
  ],
  controllers: [CareObservationController],
  providers: [
    CareObservationService,
    CareObservationRepository,
    CareSheetService,
    HisCareSheetClient,
  ],
  // Exported so TreatmentOrderService can assign sheets inside its transaction.
  exports: [CareObservationService],
})
export class CareObservationModule {}
