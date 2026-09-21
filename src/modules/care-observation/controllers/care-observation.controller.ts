import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import {
  CareObservationEntryResponseDto,
  CareObservationTaskDetailDto,
  CareObservationTaskResponseDto,
  CreateCareObservationEntryDto,
} from '../dtos/care-observation.dto';
import { CareObservationService } from '../services/care-observation.service';

@ApiTags('Care Observation')
@ApiBearerAuth()
@Controller('care-observation')
export class CareObservationController {
  constructor(private readonly service: CareObservationService) {}

  @Get('tasks/mine')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Open care observation sheets assigned to the caller',
    description:
      'Nurses see the sheets of the cases assigned to them (patient_cases.assigned_nurse_id); a Head Nurse sees every open sheet in the ward.',
  })
  @ApiResponse({ status: 200, type: [CareObservationTaskResponseDto] })
  getMyTasks(@CurrentUser() user: UserResponseDto): Promise<CareObservationTaskResponseDto[]> {
    return this.service.getMyTasks(user);
  }

  @Get('tasks/patient/:caseId')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: "A patient's currently open care observation sheet (with its checklist)",
  })
  @ApiResponse({ status: 200, type: CareObservationTaskResponseDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  getTaskForPatient(
    @Param('caseId') caseId: string,
  ): Promise<CareObservationTaskResponseDto | null> {
    return this.service.getTaskForPatient(caseId);
  }

  @Get('tasks/:taskId')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({ summary: 'Care observation sheet detail with the entries filled in so far' })
  @ApiResponse({ status: 200, type: CareObservationTaskDetailDto })
  @ApiNotFoundResponse({ description: 'Task not found' })
  getTaskDetail(
    @Param('taskId', ParseIntPipe) taskId: number,
  ): Promise<CareObservationTaskDetailDto> {
    return this.service.getTaskDetail(taskId);
  }

  @Post('tasks/:taskId/entries')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE)
  @ApiOperation({
    summary: 'Record an observation against an open sheet',
    description:
      'Observer identity and timestamp are derived server-side from the authenticated user.',
  })
  @ApiResponse({ status: 201, type: CareObservationEntryResponseDto })
  @ApiNotFoundResponse({ description: 'Task not found' })
  addEntry(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCareObservationEntryDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<CareObservationEntryResponseDto> {
    return this.service.addEntry(taskId, dto, user);
  }
}
