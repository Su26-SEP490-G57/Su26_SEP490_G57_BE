import {
  Body,
  Controller,
  Delete,
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
import { PaginatedAssessmentHistoryDto } from '../../symptom-survey/dtos/symptom-survey-response.dto';
import { SymptomSurveyService } from '../../symptom-survey/services/symptom-survey.service';
import { CreateReassessmentDto } from '../../symptom-survey/dtos/create-reassessment.dto';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PaginatedPatientsDto, PatientListItemDto } from '../dtos/patient-response.dto';
import { PodLockDto, PodLockResponseDto } from '../dtos/pod-lock.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
import { UpdateDietLevelDto } from '../dtos/update-diet-level.dto';
import { UpdatePodLevelDto } from '../dtos/update-pod-level.dto';
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
}

class OperationTypeDto implements PatientOperationType {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật đại trực tràng' })
  name!: string;
}

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly symptomSurveyService: SymptomSurveyService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get the priority patient list',
    description:
      'Paginated patient list. Supports search by case_id/full name, filter by level, operation type, nurseUserId, ' +
      'and sort by POD. Default ordering: level (Red→Yellow→Green) then oldest case to the newest.',
  })
  @ApiResponse({ status: 200, type: PaginatedPatientsDto })
  getAllPatients(
    @CurrentUser() user: { id: number; roles?: string[] },
    @Query() query: QueryPatientDto,
  ): Promise<PaginatedPatients> {
    if (
      user?.id &&
      !query.nurseUserId &&
      user.roles?.includes('Nurse') &&
      !user.roles?.includes('Head_Nurse') &&
      !user.roles?.includes('Admin')
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

  @Post()
  @ApiOperation({
    summary: 'Create a patient (case + linked login account)',
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
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({ summary: 'Get assessment history for a patient (Nurse/Head Nurse only)' })
  @ApiResponse({ status: 200, type: PaginatedAssessmentHistoryDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getAssessmentHistory(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedAssessmentHistoryDto> {
    return this.symptomSurveyService.getAssessmentHistory(id, +page, +limit);
  }

  @Post(':id/reassessments')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Submit a clinical reassessment for a patient (Nurse/Head Nurse only)',
    description:
      'Điều dưỡng tạo đánh giá lại lâm sàng — cập nhật triage color bệnh nhân kèm ghi chú, ' +
      'không cần câu trả lời khảo sát. Bản ghi được lưu vào patient_assessments với source=REASSESSMENT ' +
      'và details=[], nên tự nhiên có thứ tự đúng trong GET assessments timeline.',
  })
  @ApiResponse({ status: 201 })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  submitReassessment(
    @Param('id') id: string,
    @Body() dto: CreateReassessmentDto,
    @CurrentUser() caller: { id: number; roles?: string[]; caseId?: string },
  ) {
    dto.caseId = id; // Override caseId từ URL param để tránh spoofing
    return this.symptomSurveyService.submitReassessment(dto, caller as any);
  }

  @Post(':id/start-eras')
  @Roles(UserRoleName.HEAD_NURSE)
  @ApiOperation({ summary: 'Start ERAS protocol for a patient (Head Nurse only)' })
  @ApiResponse({ status: 201 })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 400, description: 'ERAS already started' })
  startEras(@Param('id') id: string) {
    return this.patientService.startEras(id);
  }

  @Patch(':id/pod-lock')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Lock or unlock POD progression for a patient',
    description:
      'Nurse/Head Nurse only. When locking, holdReason is required. Emits real-time WebSocket event pod.locked / pod.unlocked to /patients namespace.',
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
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Update diet level for a patient based on clinical tolerance',
    description: 'Nurse/Head Nurse only. Updates current_diet_level (0 to 4).',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  updateDietLevel(
    @Param('id') id: string,
    @Body() dto: UpdateDietLevelDto,
    @CurrentUser() user: { id: number },
  ): Promise<PatientWithAccount> {
    return this.patientService.updateDietLevel(id, dto.dietLevel, user.id);
  }

  @Patch(':id/pod-level')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Manually adjust POD level for a patient (rollback only)',
    description:
      'Nurse/Head Nurse only. Allows rolling back to a previous POD level. ' +
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
  @ApiOperation({
    summary: 'Update a patient (case + linked login account)',
    description:
      'The :id is the users.user_id of the patient account. Updates the patient_cases row and the ' +
      'linked account. Only provided fields are changed.',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 409, description: 'Username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid operation type or assigned nurse' })
  updatePatient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientWithAccount> {
    return this.patientService.updatePatient(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a patient by account user id (account + linked case)',
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
