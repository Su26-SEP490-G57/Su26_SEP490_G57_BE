import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { AnalyticsOverviewResponseDto } from '../dtos/analytics-overview-response.dto';
import { AssessmentMatrixResponseDto } from '../dtos/assessment-matrix-response.dto';
import { PatientComplianceResponseDto } from '../dtos/patient-compliance-response.dto';
import { QueryAnalyticsOverviewDto } from '../dtos/query-analytics-overview.dto';
import { RecoveryMatrixResponseDto } from '../dtos/recovery-matrix-response.dto';
import { StatisticsService } from '../services/statistics.service';

/**
 * Nurse analytics dashboard (SEP490-377). Mounted at the same `patients`
 * prefix as PatientController; the literal `analytics/overview` route is
 * declared first so it can never be shadowed by a `:caseId/...` route (same
 * pattern as `operation-types` in PatientController).
 */
@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('analytics/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'Ward-level analytics overview (Nurse/Head Nurse only)',
    description:
      'Symptom trend by POD and ERAS-compliance breakdown for the patient cohort matching the ' +
      'same filters as GET /patients (search/level/operationTypeId/room).',
  })
  @ApiResponse({ status: 200, type: AnalyticsOverviewResponseDto })
  getOverview(@Query() query: QueryAnalyticsOverviewDto): Promise<AnalyticsOverviewResponseDto> {
    return this.statisticsService.getOverview(query);
  }

  @Get(':caseId/recovery-matrix')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({ summary: 'Recovery matrix for a patient (Nurse/Head Nurse only)' })
  @ApiResponse({ status: 200, type: RecoveryMatrixResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getRecoveryMatrix(@Param('caseId') caseId: string): Promise<RecoveryMatrixResponseDto> {
    return this.statisticsService.getRecoveryMatrix(caseId);
  }

  @Get(':caseId/compliance')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'App-engagement / assessment compliance for a patient (Nurse/Head Nurse only)',
  })
  @ApiResponse({ status: 200, type: PatientComplianceResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getPatientCompliance(@Param('caseId') caseId: string): Promise<PatientComplianceResponseDto> {
    return this.statisticsService.getPatientCompliance(caseId);
  }

  @Get(':caseId/assessment-matrix')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'Per-question assessment matrix across PODs for a patient (Nurse/Head Nurse only)',
  })
  @ApiResponse({ status: 200, type: AssessmentMatrixResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getAssessmentMatrix(@Param('caseId') caseId: string): Promise<AssessmentMatrixResponseDto> {
    return this.statisticsService.getAssessmentMatrix(caseId);
  }
}
