/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditLog } from '../../audit-log/decorators/audit-log.decorator';
import { PaginatedAssessmentHistoryDto } from '../../symptom-survey/dtos/symptom-survey-response.dto';
import { SymptomSurveyService } from '../../symptom-survey/services/symptom-survey.service';
import { CreateReassessmentDto } from '../../symptom-survey/dtos/create-reassessment.dto';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { ExternalSurgicalRecordListDto } from '../dtos/external-record.dto';
import { ImportPatientsDto, ImportPatientsResultDto } from '../dtos/import-patients.dto';
import { PaginatedPatientsDto, PatientListItemDto } from '../dtos/patient-response.dto';
import { PodLockDto, PodLockResponseDto } from '../dtos/pod-lock.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { UpdateDietLevelDto } from '../dtos/update-diet-level.dto';
import { UpdatePodLevelDto } from '../dtos/update-pod-level.dto';
import { ExternalRecordsService } from '../services/external-records.service';
import { PatientImportService } from '../services/patient-import.service';
import {
  CurrentPodResponse,
  PaginatedPatients,
  PatientOperationType,
  PatientService,
  PatientWithAccount,
} from '../services/patient.service';

class CurrentPodResponseDto implements CurrentPodResponse {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 3, nullable: true })
  currentPod!: number | null;

  @ApiProperty({ example: false })
  isLocked!: boolean;

  @ApiProperty({ example: 'Bệnh nhân nôn nhiều', nullable: true })
  holdReason!: string | null;

  @ApiProperty({ example: 'GREEN', nullable: true })
  triageColor?: string | null;

  @ApiProperty({ example: false, nullable: true })
  isAssessmentLocked?: boolean;

  @ApiProperty({ example: false, nullable: true })
  erasCompleted?: boolean;

  @ApiProperty({ example: true, nullable: true })
  canSubmitAssessment?: boolean;

  @ApiProperty({ example: null, nullable: true })
  assessmentDisabledReason?: string | null;
}

class OperationTypeDto implements PatientOperationType {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật đại trực tràng' })
  name!: string;
}

/** Account/assignment fields only a Head Nurse or Doctor may change via PATCH /patients/:id. */
const NURSE_RESTRICTED_UPDATE_FIELDS = [
  'username',
  'password',
  'isActive',
  'assignedNurseId',
] as const satisfies readonly (keyof UpdatePatientDto)[];

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly symptomSurveyService: SymptomSurveyService,
    private readonly externalRecordsService: ExternalRecordsService,
    private readonly patientImportService: PatientImportService,
  ) {}

  @Get()
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Get the priority patient list (Nurse/Head Nurse/Doctor)',
    description:
      'Paginated patient list. Supports search by case_id/full name, filter by level, operation type, nurseUserId, ' +
      'and sort by POD. Default ordering: level (Red→Yellow→Green) then oldest case to the newest.',
  })
  @ApiResponse({ status: 200, type: PaginatedPatientsDto })
  getAllPatients(
    @CurrentUser() user: { id: number; roles?: string[] },
    @Query() query: QueryPatientDto,
  ): Promise<PaginatedPatients> {
    // The application represents one ward. Doctors are responsible for every
    // case in that ward, including patients whose ERAS protocol is completed.
    if (user.roles?.includes(UserRoleName.DOCTOR)) {
      query.includeCompleted = true;
    }

    if (
      user?.id &&
      !query.nurseUserId &&
      user.roles?.some((r) => String(r).toLowerCase() === 'nurse') &&
      !user.roles?.some((r) => String(r).toLowerCase() === 'head_nurse') &&
      !user.roles?.some((r) => String(r).toLowerCase() === 'admin')
    ) {
      query.nurseUserId = user.id;
    }
    return this.patientService.getAllPatients(query);
  }

  @Get('operation-types')
  @ApiOperation({
    summary: 'List operation types',
    description: 'Options for the surgery-type dropdown on the create/edit patient form.',
  })
  @ApiResponse({ status: 200, type: [OperationTypeDto] })
  getOperationTypes(): Promise<PatientOperationType[]> {
    return this.patientService.getOperationTypes();
  }

  @Get('external-records')
  @ApiOperation({
    summary: 'Fetch surgical patient records from the external HIS',
    description:
      'Calls the external (dummy) HIS service and returns all patients that have undergone ' +
      'surgery. Used to source patient records from another system instead of manual entry. ' +
      'Returns the list as provided by the HIS; it does not import them into patient_cases.',
  })
  @ApiResponse({ status: 200, type: ExternalSurgicalRecordListDto })
  @ApiResponse({ status: 502, description: 'The external HIS service is unreachable' })
  getExternalSurgicalRecords(): Promise<ExternalSurgicalRecordListDto> {
    return this.externalRecordsService.getSurgicalRecords();
  }

  @Get('nurse-pause-logs')
  @Roles(UserRoleName.DOCTOR, UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'Get nurse update logs (vital signs, diet pauses) for doctor notifications',
  })
  getNursePauseLogs(@Query('page') page = 1, @Query('limit') limit = 100) {
    return this.patientService.getNursePauseLogs(+page, +limit);
  }

  @Post('import')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'CREATE',
    entityType: 'patient_cases',
    getEntityId: () => `BULK_IMPORT_${new Date().getTime()}`,
    getChanges: (_req, res) => ({
      after: {
        importedCount: res?.imported?.length ?? 0,
        skippedCount: res?.skipped?.length ?? 0,
        failedCount: res?.failed?.length ?? 0,
      },
    }),
  })
  @ApiOperation({
    summary: 'Import selected HIS records as patients and start ERAS (Nurse/Head Nurse/Doctor)',
    description:
      'For each selected surgical record: creates the patient_cases row + linked login account ' +
      '(username = case id, password = 123456) and immediately starts the ERAS protocol. ' +
      'Records are processed independently; already-existing cases are skipped. ' +
      'Returns a per-record summary (imported / skipped / failed).',
  })
  @ApiResponse({ status: 201, type: ImportPatientsResultDto })
  importPatients(@Body() dto: ImportPatientsDto): Promise<ImportPatientsResultDto> {
    return this.patientImportService.importSurgicalRecords(dto.records);
  }

  @Post()
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'CREATE',
    entityType: 'patient_cases',
    getEntityId: (_req, res) => res?.caseId ?? 'unknown',
    getChanges: (req) => ({
      after: {
        caseId: (req.body as { caseId?: unknown }).caseId,
        fullName: (req.body as { fullName?: unknown }).fullName,
        operationTypeId: (req.body as { operationTypeId?: unknown }).operationTypeId,
        roomCode: (req.body as { roomCode?: unknown }).roomCode,
      },
    }),
  })
  @ApiOperation({
    summary: 'Create a patient (case + linked login account) - Head Nurse/Doctor only',
    description:
      'Creates the patient_cases row and the linked Patient-role users account atomically. ' +
      'If username/password are omitted, the username defaults to the case id and the password to a system default.',
  })
  @ApiResponse({ status: 201, type: PatientListItemDto })
  @ApiResponse({ status: 409, description: 'Case id or username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid operation type or assigned nurse' })
  createPatient(@Body() dto: CreatePatientDto): Promise<PatientWithAccount> {
    return this.patientService.createPatient(dto);
  }

  @Get(':id/current-pod')
  @ApiOperation({ summary: 'Get current POD day for a patient' })
  @ApiResponse({ status: 200, type: CurrentPodResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getCurrentPod(@Param('id') id: string): Promise<CurrentPodResponse> {
    return this.patientService.getCurrentPod(id);
  }

  @Get(':id/assessments')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR, UserRoleName.PATIENT)
  @ApiOperation({ summary: 'Get assessment history for a patient' })
  @ApiResponse({ status: 200, type: PaginatedAssessmentHistoryDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getAssessmentHistory(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<PaginatedAssessmentHistoryDto> {
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== id) {
      throw new ForbiddenException('You can only view your own assessment history');
    }
    return this.symptomSurveyService.getAssessmentHistory(id, +page, +limit);
  }

  @Post(':id/reassessments')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'CREATE',
    entityType: 'patient_assessments',
    getEntityId: (req, res) => res?.assessmentId?.toString() ?? `${req.params.id}_reassessment`,
    getChanges: (req) => ({
      after: {
        caseId: req.params.id,
        levelId: (req.body as { levelId?: unknown }).levelId,
        note: (req.body as { note?: unknown }).note,
        source: 'REASSESSMENT',
      },
    }),
  })
  @ApiOperation({
    summary: 'Submit a clinical reassessment for a patient (Nurse/Head Nurse/Doctor)',
    description:
      'Điều dưỡng hoặc Bác sĩ tạo đánh giá lại lâm sàng — cập nhật triage color bệnh nhân kèm ghi chú, ' +
      'không cần câu trả lời khảo sát. Bản ghi được lưu vào patient_assessments với source=REASSESSMENT ' +
      'và details=[], nên tự nhiên có thứ tự đúng trong GET assessments timeline.',
  })
  @ApiResponse({ status: 201 })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  submitReassessment(
    @Param('id') id: string,
    @Body() dto: CreateReassessmentDto,
    @CurrentUser() caller: UserResponseDto,
  ) {
    dto.caseId = id; // Override caseId từ URL param để tránh spoofing
    return this.symptomSurveyService.submitReassessment(dto, caller);
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Get a patient clinical profile by case ID' })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getPatientByCaseId(@Param('caseId') caseId: string): Promise<PatientWithAccount> {
    return this.patientService.getPatientByCaseId(caseId);
  }

  @Post(':id/start-eras')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'UPDATE',
    entityType: 'patient_cases',
    getEntityId: (req) => req.params.id,
    getChanges: () => ({
      after: {
        erasStarted: true,
        surgeryDate: new Date().toISOString(),
      },
    }),
  })
  @ApiOperation({ summary: 'Start ERAS protocol for a patient (Head Nurse/Doctor only)' })
  @ApiResponse({ status: 201 })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 400, description: 'ERAS already started' })
  startEras(@Param('id') id: string) {
    return this.patientService.startEras(id);
  }

  @Patch(':id/pod-lock')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'UPDATE',
    entityType: 'patient_cases',
    getEntityId: (req) => req.params.id,
    getChanges: (req) => ({
      after: {
        isLocked: (req.body as { isLocked?: unknown }).isLocked,
        holdReason: (req.body as { holdReason?: unknown }).holdReason,
      },
    }),
  })
  @ApiOperation({
    summary: 'Lock or unlock POD progression for a patient',
    description:
      'Nurse/Head Nurse/Doctor. When locking, holdReason is required. Emits real-time WebSocket event pod.locked / pod.unlocked to /patients namespace.',
  })
  @ApiResponse({ status: 200, type: PodLockResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 400, description: 'No active POD or holdReason missing' })
  lockPod(
    @Param('id') id: string,
    @Body() dto: PodLockDto,
    @CurrentUser() user: { id: number },
  ): Promise<PodLockResponseDto> {
    return this.patientService.lockPod(id, dto, user.id);
  }

  @Patch(':id/diet-level')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'UPDATE',
    entityType: 'patient_cases',
    getEntityId: (req) => req.params.id,
    getChanges: (req, res) => ({
      before: { dietLevel: (res as { previousDietLevel?: unknown })?.previousDietLevel },
      after: {
        dietLevel: (req.body as { dietLevel?: unknown }).dietLevel,
        reason: (req.body as { reason?: unknown }).reason,
      },
    }),
  })
  @ApiOperation({
    summary: 'Update diet level for a patient based on clinical tolerance',
    description:
      'Nurse/Head Nurse/Doctor. Nurses and Head Nurses can safely lower the level; doctors can both increase and decrease it. Updates current_diet_level (0 to max protocol dietLevel, typically 0-4).',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  async updateDietLevel(
    @Param('id') id: string,
    @Body() dto: UpdateDietLevelDto,
    @CurrentUser() user: { id: number; roles?: string[] },
  ): Promise<PatientWithAccount> {
    // Lấy giá trị cũ trước khi update để ghi vào audit log
    const patientBefore = await this.patientService.getPatientByCaseId(id);
    const previousDietLevel = patientBefore.currentDietLevel;

    const result = await this.patientService.updateDietLevel(
      id,
      dto.dietLevel,
      user.id,
      dto.reason,
      user.roles?.includes(UserRoleName.DOCTOR) ?? false,
    );

    // Attach previousDietLevel vào response để AuditLog interceptor dùng
    (result as PatientWithAccount & { previousDietLevel?: number | null }).previousDietLevel =
      previousDietLevel;

    return result;
  }

  @Patch(':id/pod-level')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @AuditLog({
    action: 'UPDATE',
    entityType: 'patient_cases',
    getEntityId: (req) => req.params.id,
    getChanges: (req, res) => ({
      before: { podLevel: (res as { previousPod?: unknown })?.previousPod },
      after: {
        podLevel: (req.body as { podLevel?: unknown }).podLevel,
        reason: (req.body as { reason?: unknown }).reason,
      },
    }),
  })
  @ApiOperation({
    summary: 'Manually adjust POD level for a patient (rollback only)',
    description:
      'Nurse/Head Nurse/Doctor. Allows rolling back to a previous POD level. ' +
      'The new podLevel must be >= 0 and < current_pod (only backward movement allowed).',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid POD level: must be >= 0 and < current_pod',
  })
  updatePodLevel(
    @Param('id') id: string,
    @Body() dto: UpdatePodLevelDto,
    @CurrentUser() user: { id: number },
  ): Promise<PatientWithAccount> {
    return this.patientService.updatePodLevel(id, dto.podLevel, user.id);
  }

  @Patch(':id')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Update a patient (case + linked login account) - Nurse/Head Nurse/Doctor',
    description:
      'The :id is the users.user_id of the patient account. Updates the patient_cases row and the ' +
      'linked account. Only provided fields are changed. Allows assigning/reassigning nurse to patient. ' +
      'A plain Nurse may only edit patient information — not login credentials, account status or the ' +
      'assigned nurse.',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 409, description: 'Username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid operation type or assigned nurse' })
  updatePatient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: { id: number; roles?: string[] },
  ): Promise<PatientWithAccount> {
    const isPlainNurse =
      !user.roles?.includes(UserRoleName.HEAD_NURSE) && !user.roles?.includes(UserRoleName.DOCTOR);
    if (isPlainNurse) {
      const restricted = NURSE_RESTRICTED_UPDATE_FIELDS.filter((field) => dto[field] !== undefined);
      if (restricted.length > 0) {
        throw new ForbiddenException(`Nurses cannot update: ${restricted.join(', ')}`);
      }
    }
    return this.patientService.updatePatient(id, dto);
  }

  @Delete(':id')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Soft-delete a patient by account user id - Head Nurse/Doctor only',
    description:
      'The :id is the users.user_id of the patient account. Marks the account and its ' +
      'linked patient_cases row as deleted (deleted_at). Clinical history is preserved ' +
      'and the records are excluded from all queries.',
  })
  @ApiResponse({ status: 200, description: 'Patient soft-deleted' })
  @ApiNotFoundResponse({ description: 'User not found' })
  deletePatient(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ userId: number; caseId: string | null; deleted: true }> {
    return this.patientService.deletePatient(id);
  }
}
