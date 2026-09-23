import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patient/entities/patient.entity';
import { User } from '../user/entities/user.entity';
import { VitalSign } from '../vital-signs/entities/vital-sign.entity';

const DEFAULT_FACILITY = 'Bệnh viện Đa khoa';
const DEFAULT_DEPARTMENT = 'Khoa Ngoại';

/** Administrative header shared by every sheet written to the HIS. */
export interface PatientSheetHeader {
  facility: string;
  department: string;
  patientName: string;
  age: number | null;
  gender: string | null;
  room: string | null;
  bed: string | null;
  diagnosis: string | null;
  comorbidities: string[];
}

/**
 * Builds the patient header of HIS sheets ("Phiếu theo dõi điều trị",
 * "Phiếu theo dõi và chăm sóc") from the patient case — the client never
 * supplies these fields.
 */
@Injectable()
export class PatientSheetHeaderService {
  readonly facility: string;
  readonly department: string;

  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(VitalSign)
    private readonly vitalSignRepo: Repository<VitalSign>,
  ) {
    this.facility = config.get<string>('HOSPITAL_FACILITY_NAME') || DEFAULT_FACILITY;
    this.department = config.get<string>('HOSPITAL_DEPARTMENT_NAME') || DEFAULT_DEPARTMENT;
  }

  async build(patient: Patient): Promise<PatientSheetHeader> {
    const user = await this.userRepo.findOne({ where: { caseId: patient.caseId } });
    const { room, bed } = splitRoomBed(patient.roomBed);
    return {
      facility: this.facility,
      department: this.department,
      patientName: user?.fullName ?? patient.caseId,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
      room,
      bed,
      diagnosis: patient.diagnosis?.trim() || null,
      comorbidities: (patient.comorbidities ?? []).filter(Boolean),
    };
  }

  findLatestVitalSign(caseId: string): Promise<VitalSign | null> {
    return this.vitalSignRepo.findOne({
      where: { caseId },
      order: { recordedAt: 'DESC', vitalSignId: 'DESC' },
    });
  }
}

/** "P101-B2" (the import format) → room "P101", bed "2"; anything else is the room. */
export function splitRoomBed(roomBed: string | null): { room: string | null; bed: string | null } {
  const value = roomBed?.trim();
  if (!value) return { room: null, bed: null };
  const match = /^(.+?)-B(\d+)$/i.exec(value);
  return match ? { room: match[1], bed: match[2] } : { room: value, bed: null };
}
