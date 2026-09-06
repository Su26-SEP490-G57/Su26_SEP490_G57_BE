import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { AnalyticsOverviewResponseDto } from '../dtos/analytics-overview-response.dto';
import { AssessmentMatrixResponseDto } from '../dtos/assessment-matrix-response.dto';
import { CreateEngagementLogDto } from '../dtos/create-engagement-log.dto';
import { EngagementLogResponseDto } from '../dtos/engagement-log-response.dto';
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
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Ward-level analytics overview (Nurse/Head Nurse/Doctor)',
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
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({ summary: 'Recovery matrix for a patient (Nurse/Head Nurse/Doctor)' })
  @ApiResponse({ status: 200, type: RecoveryMatrixResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getRecoveryMatrix(@Param('caseId') caseId: string): Promise<RecoveryMatrixResponseDto> {
    return this.statisticsService.getRecoveryMatrix(caseId);
  }

  @Get(':caseId/compliance')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'App-engagement / assessment compliance for a patient (Nurse/Head Nurse/Doctor)',
  })
  @ApiResponse({ status: 200, type: PatientComplianceResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getPatientCompliance(@Param('caseId') caseId: string): Promise<PatientComplianceResponseDto> {
    return this.statisticsService.getPatientCompliance(caseId);
  }

  @Post(':caseId/engagement-logs')
  @ApiOperation({
    summary: 'Log a patient app-engagement event (guidance/education viewed)',
    description:
      'Called by the patient mobile app when the patient views POD diet guidance or health ' +
      'education content, so the nurse compliance checklist (GET .../compliance) reflects it. ' +
      'A Patient caller may only log against their own case.',
  })
  @ApiResponse({ status: 201, type: EngagementLogResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  logEngagement(
    @Param('caseId') caseId: string,
    @Body() dto: CreateEngagementLogDto,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<EngagementLogResponseDto> {
    return this.statisticsService.logEngagement(caseId, dto, caller);
  }

  @Get(':caseId/assessment-matrix')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Per-question assessment matrix across PODs for a patient (Nurse/Head Nurse/Doctor)',
  })
  @ApiResponse({ status: 200, type: AssessmentMatrixResponseDto })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  getAssessmentMatrix(@Param('caseId') caseId: string): Promise<AssessmentMatrixResponseDto> {
    return this.statisticsService.getAssessmentMatrix(caseId);
  }
}
