import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import {
  ImportPatientsResultDto,
  ImportResultItemDto,
  ImportSurgicalRecordDto,
} from '../dtos/import-patients.dto';
import { PatientService } from './patient.service';

/** Default login password for patients imported from the HIS. */
const IMPORT_DEFAULT_PASSWORD = '123456';

/**
 * Imports surgical patient records selected from the external HIS: for each
 * record it creates the patient_cases row + linked login account (username =
 * case id, password = 123456) and immediately starts the ERAS protocol.
 * Records are processed independently — one failure/skip does not abort the
 * rest — and a per-record summary is returned.
 */
@Injectable()
export class PatientImportService {
  private readonly logger = new Logger(PatientImportService.name);

  constructor(private readonly patientService: PatientService) {}

  async importSurgicalRecords(
    records: ImportSurgicalRecordDto[],
  ): Promise<ImportPatientsResultDto> {
    const results: ImportResultItemDto[] = [];

    for (const record of records) {
      const caseId = record.hospitalPatientCode;
      try {
        // 1. Create the case + login account (username defaults to caseId).
        await this.patientService.createPatient(this.toCreateDto(record));

        // 2. Start ERAS for the freshly created case (same action as create).
        let erasStarted = false;
        let message: string | null = null;
        try {
          await this.patientService.startEras(caseId);
          erasStarted = true;
        } catch (err) {
          // Case was created but ERAS could not start — report, don't fail.
          message = `Created but failed to start ERAS: ${this.msg(err)}`;
          this.logger.warn(`${caseId}: ${message}`);
        }

        results.push({
          recordId: record.recordId,
          caseId,
          status: 'imported',
          erasStarted,
          message,
        });
      } catch (err) {
        // Already exists → skipped; anything else → failed.
        const skipped = err instanceof ConflictException;
        results.push({
          recordId: record.recordId,
          caseId,
          status: skipped ? 'skipped' : 'failed',
          erasStarted: false,
          message: this.msg(err),
        });
        if (!skipped) this.logger.error(`Import failed for ${caseId}: ${this.msg(err)}`);
      }
    }

    return {
      total: records.length,
      imported: results.filter((r) => r.status === 'imported').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  /** Map a HIS record onto the create-patient shape (fixed 123456 password). */
  private toCreateDto(record: ImportSurgicalRecordDto): CreatePatientDto {
    const dto = new CreatePatientDto();
    dto.caseId = record.hospitalPatientCode;
    // username omitted → defaults to caseId in PatientService.createPatient.
    dto.password = IMPORT_DEFAULT_PASSWORD;
    dto.fullName = record.patientName;

    const gender = this.mapSex(record.sex);
    if (gender) dto.gender = gender;

    const age = this.ageFromDob(record.dateOfBirth);
    if (age != null) dto.age = age;

    if (record.heightCm != null) dto.height = record.heightCm;
    if (record.weightKg != null) dto.weight = record.weightKg;

    const bmi = this.bmi(record.heightCm, record.weightKg);
    if (bmi != null) dto.bmi = bmi;

    if (record.admissionDiagnosis) dto.diagnosis = record.admissionDiagnosis;

    const method = record.procedureName ?? record.surgicalApproach ?? undefined;
    if (method) dto.method = method.slice(0, 100);

    if (record.bowelAnastomosis != null) dto.hasGiAnastomosis = record.bowelAnastomosis;

    const surgeryDate = this.dateOnly(record.operatedAt);
    if (surgeryDate) dto.surgeryDate = surgeryDate;

    const roomBed = [record.wardCode, record.bedNumber].filter(Boolean).join(' ').trim();
    if (roomBed) dto.roomBed = roomBed.slice(0, 50);

    if (record.contactPhone) dto.phoneNumber = record.contactPhone.slice(0, 20);

    return dto;
  }

  private mapSex(sex?: string | null): string | undefined {
    if (!sex) return undefined;
    const s = sex.trim().toUpperCase();
    if (s === 'M') return 'Nam';
    if (s === 'F') return 'Nữ';
    return undefined;
  }

  /** Whole years between dob and today; null if dob missing/invalid. */
  private ageFromDob(dob?: string | null): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }

  private bmi(heightCm?: number | null, weightKg?: number | null): number | null {
    if (heightCm == null || weightKg == null || heightCm <= 0) return null;
    const m = heightCm / 100;
    return Math.round((weightKg / (m * m)) * 10) / 10;
  }

  /** Extract YYYY-MM-DD from an ISO timestamp; null if missing/invalid. */
  private dateOnly(iso?: string | null): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  private msg(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
