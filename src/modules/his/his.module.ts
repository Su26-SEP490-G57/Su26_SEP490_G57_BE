import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { VitalSign } from '../vital-signs/entities/vital-sign.entity';
import { HisHttpClient } from './his-http.client';
import { PatientSheetHeaderService } from './patient-sheet-header.service';
import { SheetPdfService } from './sheet-pdf.service';

/** Shared plumbing for sheets stored in the external HIS. */
@Module({
  imports: [TypeOrmModule.forFeature([User, VitalSign])],
  providers: [HisHttpClient, PatientSheetHeaderService, SheetPdfService],
  exports: [HisHttpClient, PatientSheetHeaderService, SheetPdfService],
})
export class HisModule {}
