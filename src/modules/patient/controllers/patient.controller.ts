import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentPodResponse, PatientService, PatientWithAccount } from '../services/patient.service';

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
  @ApiOperation({ summary: 'Get all patients (case data joined with user account)' })
  @ApiResponse({ status: 200, description: 'List of all patients' })
  getAllPatients(): Promise<PatientWithAccount[]> {
    return this.patientService.getAllPatients();
  }

  @Get(':id/current-pod')
  @ApiOperation({ summary: 'Get current POD day for a patient' })
  @ApiResponse({ status: 200, type: CurrentPodResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getCurrentPod(@Param('id') id: string): Promise<CurrentPodResponse> {
    return this.patientService.getCurrentPod(id);
  }
}
