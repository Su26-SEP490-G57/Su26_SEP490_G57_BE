import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patient/entities/patient.entity';
import { VitalSignsController } from './controllers/vital-signs.controller';
import { VitalSign } from './entities/vital-sign.entity';
import { VitalSignRepository } from './repositories/vital-sign.repository';
import { VitalSignsService } from './services/vital-signs.service';

import { PatientModule } from '../patient/patient.module';
import { AlertModule } from '../alert/alert.module';

@Module({
  imports: [TypeOrmModule.forFeature([VitalSign, Patient]), PatientModule, AlertModule],
  controllers: [VitalSignsController],
  providers: [VitalSignsService, VitalSignRepository],
  exports: [VitalSignsService],
})
export class VitalSignsModule {}
