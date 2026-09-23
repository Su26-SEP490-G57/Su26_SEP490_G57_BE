import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { VitalSign } from '../vital-signs/entities/vital-sign.entity';
import { HisHttpClient } from './his-http.client';
import { PatientSheetHeaderService } from './patient-sheet-header.service';

/** Shared plumbing for sheets stored in the external HIS. */
@Module({
  imports: [TypeOrmModule.forFeature([User, VitalSign])],
  providers: [HisHttpClient, PatientSheetHeaderService],
  exports: [HisHttpClient, PatientSheetHeaderService],
})
export class HisModule {}
