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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreatePatientDto } from '../dtos/create-patient.dto';
import { PaginatedPatientsDto, PatientListItemDto } from '../dtos/patient-response.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { UpdatePatientDto } from '../dtos/update-patient.dto';
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
}

class OperationTypeDto implements PatientOperationType {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Phẫu thuật đại trực tràng' })
  name!: string;
}

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the priority patient list',
    description:
      'Paginated patient list. Supports search by case_id/full name, filter by level and operation type, ' +
      'and sort by POD. Default ordering: level (Red→Yellow→Green) then oldest case to the newest.',
  })
  @ApiResponse({ status: 200, type: PaginatedPatientsDto })
  getAllPatients(@Query() query: QueryPatientDto): Promise<PaginatedPatients> {
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a patient (case + linked login account)',
    description: 'Updates the patient_cases row and the linked account. Only provided fields are changed.',
  })
  @ApiResponse({ status: 200, type: PatientListItemDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @ApiResponse({ status: 409, description: 'Username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid operation type or assigned nurse' })
  updatePatient(
    @Param('id') id: string,
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
