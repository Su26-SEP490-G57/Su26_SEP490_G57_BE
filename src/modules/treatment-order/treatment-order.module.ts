import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareObservationModule } from '../care-observation/care-observation.module';
import { Patient } from '../patient/entities/patient.entity';
import { HisModule } from '../his/his.module';
import { HisTreatmentSheetClient } from './clients/his-treatment-sheet.client';
import { TreatmentOrderController } from './controllers/treatment-order.controller';
import { TreatmentOrder } from './entities/treatment-order.entity';
import { TreatmentOrderRepository } from './repositories/treatment-order.repository';
import { TreatmentOrderService } from './services/treatment-order.service';

@Module({
  // One-way dependency: creating an order triggers sheet assignment, never the
  // other way round (no event bus in this codebase — the caller invokes the
  // side-effect service directly).
  imports: [TypeOrmModule.forFeature([TreatmentOrder, Patient]), CareObservationModule, HisModule],
  controllers: [TreatmentOrderController],
  providers: [TreatmentOrderService, TreatmentOrderRepository, HisTreatmentSheetClient],
  exports: [TreatmentOrderService],
})
export class TreatmentOrderModule {}
