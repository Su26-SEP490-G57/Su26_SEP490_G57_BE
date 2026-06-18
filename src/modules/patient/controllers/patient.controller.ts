import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaginatedPatientsDto } from '../dtos/patient-response.dto';
import { QueryPatientDto } from '../dtos/query-patient.dto';
import { CurrentPodResponse, PaginatedPatients, PatientService } from '../services/patient.service';

class CurrentPodResponseDto implements CurrentPodResponse {
  @ApiProperty({ example: 'CASE-001' })
  caseId!: string;

  @ApiProperty({ example: 3, nullable: true })
  currentPod!: number | null;
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

  @Get(':id/current-pod')
  @ApiOperation({ summary: 'Get current POD day for a patient' })
  @ApiResponse({ status: 200, type: CurrentPodResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getCurrentPod(@Param('id') id: string): Promise<CurrentPodResponse> {
    return this.patientService.getCurrentPod(id);
  }
}
