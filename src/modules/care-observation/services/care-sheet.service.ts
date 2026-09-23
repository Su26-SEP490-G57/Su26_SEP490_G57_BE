import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientSheetHeaderService } from '../../his/patient-sheet-header.service';
import { Patient } from '../../patient/entities/patient.entity';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { HisCareSheetClient } from '../clients/his-care-sheet.client';
import {
  CARE_SHEET_CONTENT_KEYS,
  CARE_SHEET_FORM_CODE,
  CARE_SHEET_LEGEND,
  CARE_SHEET_SECTIONS,
  CARE_SHEET_TITLES,
  CARE_SHEET_VALUE_MAX_LENGTH,
} from '../constants/care-sheet-form.constant';
import type { CareSheetType } from '../constants/care-sheet-form.constant';
import {
  CareSheetDto,
  CareSheetFormDto,
  CareSheetListDto,
  CareSheetPrefillDto,
  CreateCareSheetDto,
} from '../dtos/care-sheet.dto';
import { CareObservationRepository } from '../repositories/care-observation.repository';

/**
 * "Phiếu theo dõi và chăm sóc" (Cấp 1 / Cấp 2-3), written by nurses, head nurses or doctors and
 * stored in the HIS. Which sheet a patient gets follows the care level the
 * doctor ordered — i.e. the patient's OPEN care observation task. A patient
 * can have any number of sheets; saved sheets are immutable.
 */
@Injectable()
export class CareSheetService {
  constructor(
    private readonly repository: CareObservationRepository,
    private readonly hisClient: HisCareSheetClient,
    private readonly sheetHeader: PatientSheetHeaderService,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  async getPrefill(caseId: string, actor: UserResponseDto): Promise<CareSheetPrefillDto> {
    const patient = await this.findPatient(caseId);

    const [header, latestVitalSign, sheetType, sheetNumber] = await Promise.all([
      this.sheetHeader.build(patient),
      this.sheetHeader.findLatestVitalSign(caseId),
      this.findSheetType(caseId),
      this.hisClient.nextSheetNumber(caseId),
    ]);

    // Pre-fill what the system already knows; the nurse can still edit it.
    const content: Record<string, string> = {};
    const put = (key: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && `${value}` !== '') content[key] = `${value}`;
    };
    if (latestVitalSign) {
      put('chiSo.mach', latestVitalSign.pulseBpm);
      put('chiSo.nhietDo', Number(latestVitalSign.temperatureCelsius));
      put(
        'chiSo.huyetAp',
        `${latestVitalSign.bloodPressureSystolic}/${latestVitalSign.bloodPressureDiastolic}`,
      );
      put('chiSo.nhipTho', latestVitalSign.respiratoryRate);
      put('chiSo.spo2', latestVitalSign.spo2Percent);
    }
    put('chiSo.canNang', patient.weight);
    put('chiSo.bmi', patient.bmi === null ? null : Math.round(patient.bmi * 10) / 10);

    return {
      sheetType,
      careLevel: patient.activeCareLevel ?? null,
      sheetNumber,
      facility: header.facility,
      department: header.department,
      caseId,
      patientName: header.patientName,
      age: header.age,
      gender: header.gender,
      room: header.room,
      bed: header.bed,
      diagnosis: header.diagnosis,
      nurseName: actor.fullName,
      content,
      latestVitalSignAt: latestVitalSign?.recordedAt ?? null,
      form: this.form(),
    };
  }

  async create(
    caseId: string,
    dto: CreateCareSheetDto,
    actor: UserResponseDto,
  ): Promise<CareSheetDto> {
    const patient = await this.findPatient(caseId);

    const sheetType = await this.findSheetType(caseId);
    if (!sheetType) {
      throw new ConflictException(
        `Patient case ${caseId} has no care level ordered yet — a doctor must order one before a care sheet can be written`,
      );
    }

    const content = this.cleanContent(dto.content);
    const header = await this.sheetHeader.build(patient);

    return this.hisClient.create({
      sheetType,
      careLevel: patient.activeCareLevel ?? undefined,
      patientCode: caseId,
      patientName: header.patientName,
      facility: header.facility,
      department: header.department,
      admissionNumber: dto.admissionNumber?.trim() || undefined,
      age: header.age ?? undefined,
      gender: header.gender ?? undefined,
      room: header.room ?? undefined,
      bed: header.bed ?? undefined,
      diagnosis: header.diagnosis ?? undefined,
      hasAllergy: dto.hasAllergy,
      allergyNote: dto.hasAllergy ? dto.allergyNote?.trim() || undefined : undefined,
      recordedAt: dto.recordedAt.toISOString(),
      content,
      nurseName: actor.fullName,
    });
  }

  async list(caseId: string): Promise<CareSheetListDto> {
    await this.findPatient(caseId);
    return { sheets: await this.hisClient.listByPatient(caseId), form: this.form() };
  }

  private form(): CareSheetFormDto {
    return {
      formCode: CARE_SHEET_FORM_CODE,
      legend: CARE_SHEET_LEGEND,
      sections: CARE_SHEET_SECTIONS,
      titles: CARE_SHEET_TITLES,
    };
  }

  private async findPatient(caseId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { caseId } });
    if (!patient) {
      throw new NotFoundException(`Patient case ${caseId} not found`);
    }
    return patient;
  }

  /** Sheet type of the patient's OPEN care observation task (null = none). */
  private async findSheetType(caseId: string): Promise<CareSheetType | null> {
    const task = await this.repository.findOpenTaskByCaseId(caseId);
    if (!task) return null;
    return task.template?.code === 'LEVEL_1_SHEET' ? 'LEVEL_1' : 'LEVEL_2_3';
  }

  /** Only known keys, string values, empty values dropped. */
  private cleanContent(raw: Record<string, unknown>): Record<string, string> {
    const unknownKeys = Object.keys(raw).filter((key) => !CARE_SHEET_CONTENT_KEYS.has(key));
    if (unknownKeys.length) {
      throw new BadRequestException(`Unknown care sheet fields: ${unknownKeys.join(', ')}`);
    }

    const content: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === null || value === undefined) continue;
      if (typeof value !== 'string') {
        throw new BadRequestException(`Care sheet field ${key} must be a string`);
      }
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > CARE_SHEET_VALUE_MAX_LENGTH) {
        throw new BadRequestException(
          `Care sheet field ${key} must be at most ${CARE_SHEET_VALUE_MAX_LENGTH} characters`,
        );
      }
      content[key] = trimmed;
    }

    if (!Object.keys(content).length) {
      throw new BadRequestException('A care sheet must record at least one field');
    }
    return content;
  }
}
