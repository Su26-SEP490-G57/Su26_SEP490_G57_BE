import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import {
  ImportPatientsResultDto,
  ImportResultItemDto,
  ImportSurgicalRecordDto,
} from '../dtos/import-patients.dto';
import { PatientRepository } from '../repositories/patient.repository';
import { ExternalRecordsService } from './external-records.service';
import { PatientService } from './patient.service';

/**
 * Imports surgical patient records selected from the external HIS: for each
 * record it creates the patient_cases row + linked login account through the
 * exact same auto-provisioning as manual "Thêm mới" (username = case id,
 * password = DEFAULT_PATIENT_PASSWORD), randomly assigns an empty room/bed,
 * and immediately starts the ERAS protocol. Records are processed
 * independently — one failure/skip does not abort the rest — and a
 * per-record summary is returned.
 */
@Injectable()
export class PatientImportService {
  private readonly logger = new Logger(PatientImportService.name);

  constructor(
    private readonly patientService: PatientService,
    private readonly patientRepository: PatientRepository,
    private readonly externalRecordsService: ExternalRecordsService,
  ) {}

  async importSurgicalRecords(
    records: ImportSurgicalRecordDto[],
  ): Promise<ImportPatientsResultDto> {
    const availableRooms = await this.getShuffledAvailableRoomBeds();
    const results: ImportResultItemDto[] = [];

    for (const record of records) {
      const caseId = record.hospitalPatientCode;
      // Rooms are only actually consumed by patients that get imported below,
      // but reserving one up front keeps two records in the same batch from
      // ever landing in the same bed.
      const roomBed = availableRooms.pop() ?? null;
      try {
        // 1. Create the case + login account (username defaults to caseId).
        await this.patientService.createPatient(this.toCreateDto(record, roomBed));

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
        if (!roomBed) {
          message = [message, 'No empty room available to assign'].filter(Boolean).join('; ');
        }

        results.push({
          recordId: record.recordId,
          caseId,
          status: 'imported',
          erasStarted,
          roomBed,
          message: message || null,
        });
      } catch (err) {
        // Record wasn't imported after all — put its reserved room back in the pool.
        if (roomBed) availableRooms.push(roomBed);

        // Already exists → skipped; anything else → failed.
        const skipped = err instanceof ConflictException;
        results.push({
          recordId: record.recordId,
          caseId,
          status: skipped ? 'skipped' : 'failed',
          erasStarted: false,
          roomBed: null,
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

  /**
   * Every room/bed slot known to the HIS minus the ones already occupied by
   * active patients, shuffled so beds are handed out in random order. Falls
   * back to an empty pool (patients imported without a room) if the HIS rooms
   * endpoint can't be reached — a missing room shouldn't block the import.
   */
  private async getShuffledAvailableRoomBeds(): Promise<string[]> {
    let allBeds: string[] = [];
    try {
      const { data: rooms } = await this.externalRecordsService.getRooms();
      allBeds = rooms.flatMap((room) =>
        Array.from({ length: room.bedCount }, (_, i) => `${room.roomCode}-B${i + 1}`),
      );
    } catch (err) {
      this.logger.warn(
        `Could not fetch rooms from HIS, importing without room assignment: ${this.msg(err)}`,
      );
      return [];
    }

    const occupied = new Set(await this.patientRepository.findOccupiedRoomBeds());
    const available = allBeds.filter((bed) => !occupied.has(bed));

    // Fisher-Yates shuffle.
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available;
  }

  /** Map a HIS record onto the create-patient shape. */
  private toCreateDto(record: ImportSurgicalRecordDto, roomBed: string | null): CreatePatientDto {
    const dto = new CreatePatientDto();
    dto.caseId = record.hospitalPatientCode;
    // username and password both omitted → same auto-provisioning as manual
    // "Thêm mới": username defaults to caseId, password to
    // DEFAULT_PATIENT_PASSWORD, in PatientService.createPatient.
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

    // Room is randomly assigned from the empty rooms in the system, not taken
    // from the HIS record's ward/bed (that reflects the HIS's own building).
    if (roomBed) dto.roomBed = roomBed;

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
