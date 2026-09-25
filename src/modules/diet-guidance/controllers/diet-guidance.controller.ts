import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import {
  CreateOperationTypeDto,
  OperationTypeResponseDto,
  UpdateOperationTypeDto,
} from '../dtos/operation-type.dto';
import {
  CreatePodProtocolDto,
  PodProtocolResponseDto,
  UpdatePodProtocolDto,
} from '../dtos/pod-protocol.dto';
import {
  CustomDietGuidanceResponseDto,
  PatientCurrentDietGuidanceResponseDto,
  UpsertCustomDietGuidanceDto,
} from '../dtos/custom-diet-guidance.dto';
import { DailyDietProgressionSchedulerService } from '../services/daily-diet-progression-scheduler.service';
import { DietGuidanceService } from '../services/diet-guidance.service';

@ApiTags('Diet Guidance')
@ApiBearerAuth()
@Controller('diet-guidance')
export class DietGuidanceController {
  constructor(
    private readonly service: DietGuidanceService,
    private readonly schedulerService: DailyDietProgressionSchedulerService,
  ) {}

  // ── Patient Diet Guidance (Viewed by Patient & Staff) ───────────────────────

  @Get('patient/:caseId/current')
  @ApiOperation({
    summary:
      'Get current diet guidance for a patient (Personalized if prescribed by Doctor, or Standard POD protocol)',
  })
  @ApiResponse({ status: 200, type: PatientCurrentDietGuidanceResponseDto })
  async getCurrentPatientDietGuidance(
    @Param('caseId') caseId: string,
  ): Promise<PatientCurrentDietGuidanceResponseDto | null> {
    return this.service.getCurrentDietGuidanceForPatient(caseId);
  }

  // ── Personalized Diet Guidance (Prescribed by Doctor) ───────────────────────

  @Get('patient/:caseId/custom')
  @Roles(UserRoleName.DOCTOR, UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'Get doctor personalized diet guidance configuration for a patient case',
  })
  @ApiResponse({ status: 200, type: CustomDietGuidanceResponseDto })
  async getCustomDietGuidance(
    @Param('caseId') caseId: string,
  ): Promise<CustomDietGuidanceResponseDto | null> {
    return this.service.getCustomDietGuidance(caseId);
  }

  @Post('patient/:caseId/custom')
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Prescribe or modify personalized diet guidance for a patient case (Doctor only)',
    description:
      'Creates or updates customized diet guidance for a specific patient. Automatically sets this custom diet active.',
  })
  @ApiResponse({ status: 200, type: CustomDietGuidanceResponseDto })
  async upsertCustomDietGuidance(
    @Param('caseId') caseId: string,
    @Body() dto: UpsertCustomDietGuidanceDto,
    @CurrentUser() user: { id: number },
  ): Promise<CustomDietGuidanceResponseDto> {
    return this.service.upsertCustomDietGuidance(caseId, dto, user.id);
  }

  @Patch('patient/:caseId/custom/toggle-status')
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Toggle active status of personalized diet guidance (Doctor only)',
    description:
      'Turn active/inactive the personalized diet. If inactive, patient will fall back to standard POD protocol.',
  })
  @ApiResponse({ status: 200, type: CustomDietGuidanceResponseDto })
  async toggleCustomDietStatus(
    @Param('caseId') caseId: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() user: { id: number },
  ): Promise<CustomDietGuidanceResponseDto> {
    return this.service.toggleCustomDietStatus(caseId, isActive, user.id);
  }

  @Post('cron/process-daily-diet-progression')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({
    summary: 'Manually trigger end-of-day daily diet progression scan',
    description:
      'Scans all active patients, auto-advances diet level if latest assessment is GREEN, maintains if YELLOW/RED/missing.',
  })
  async triggerDailyDietProgression() {
    return this.schedulerService.processDailyDietProgression();
  }

  // ── Operation Types ──────────────────────────────────────────────────────────

  @Get('operation-types')
  @ApiOperation({ summary: 'List all operation types with POD count' })
  @ApiResponse({ status: 200, type: [OperationTypeResponseDto] })
  getOperationTypes(): Promise<OperationTypeResponseDto[]> {
    return this.service.getOperationTypes();
  }

  @Get('operation-types/:id')
  @ApiOperation({ summary: 'Get operation type by ID' })
  @ApiResponse({ status: 200, type: OperationTypeResponseDto })
  @ApiNotFoundResponse({ description: 'Operation type not found' })
  getOperationTypeById(@Param('id', ParseIntPipe) id: number): Promise<OperationTypeResponseDto> {
    return this.service.getOperationTypeById(id);
  }

  @Post('operation-types')
  @Roles(UserRoleName.HEAD_NURSE)
  @ApiOperation({ summary: 'Create a new operation type (Head Nurse only)' })
  @ApiResponse({ status: 201, type: OperationTypeResponseDto })
  createOperationType(@Body() dto: CreateOperationTypeDto): Promise<OperationTypeResponseDto> {
    return this.service.createOperationType(dto);
  }

  @Patch('operation-types/:id')
  @Roles(UserRoleName.HEAD_NURSE)
  @ApiOperation({ summary: 'Update an operation type (Head Nurse only)' })
  @ApiResponse({ status: 200, type: OperationTypeResponseDto })
  @ApiNotFoundResponse({ description: 'Operation type not found' })
  updateOperationType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperationTypeDto,
  ): Promise<OperationTypeResponseDto> {
    return this.service.updateOperationType(id, dto);
  }

  @Delete('operation-types/:id')
  @Roles(UserRoleName.HEAD_NURSE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an operation type (Head Nurse only)' })
  @ApiResponse({ status: 204 })
  @ApiNotFoundResponse({ description: 'Operation type not found' })
  deleteOperationType(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.deleteOperationType(id);
  }

  // ── Pod Protocols ────────────────────────────────────────────────────────────

  @Get('operation-types/:opId/pods')
  @ApiOperation({ summary: 'List all PODs for an operation type' })
  @ApiResponse({ status: 200, type: [PodProtocolResponseDto] })
  getPods(@Param('opId', ParseIntPipe) opId: number): Promise<PodProtocolResponseDto[]> {
    return this.service.getPodsByOperationType(opId);
  }

  @Get('operation-types/:opId/pods/:podId')
  @ApiOperation({ summary: 'Get a POD detail' })
  @ApiResponse({ status: 200, type: PodProtocolResponseDto })
  @ApiNotFoundResponse({ description: 'POD not found' })
  getPod(
    @Param('opId', ParseIntPipe) opId: number,
    @Param('podId', ParseIntPipe) podId: number,
  ): Promise<PodProtocolResponseDto> {
    return this.service.getPodById(opId, podId);
  }

  @Post('operation-types/:opId/pods')
  @Roles(UserRoleName.HEAD_NURSE)
  @ApiOperation({ summary: 'Create a new POD (Head Nurse only)' })
  @ApiResponse({ status: 201, type: PodProtocolResponseDto })
  createPod(
    @Param('opId', ParseIntPipe) opId: number,
    @Body() dto: CreatePodProtocolDto,
    @CurrentUser() user: { id: number },
  ): Promise<PodProtocolResponseDto> {
    return this.service.createPod(opId, dto, user.id);
  }

  @Patch('operation-types/:opId/pods/:podId')
  @Roles(UserRoleName.HEAD_NURSE)
  @ApiOperation({ summary: 'Update a POD inline (Head Nurse only)' })
  @ApiResponse({ status: 200, type: PodProtocolResponseDto })
  @ApiNotFoundResponse({ description: 'POD not found' })
  updatePod(
    @Param('opId', ParseIntPipe) opId: number,
    @Param('podId', ParseIntPipe) podId: number,
    @Body() dto: UpdatePodProtocolDto,
    @CurrentUser() user: { id: number },
  ): Promise<PodProtocolResponseDto> {
    return this.service.updatePod(opId, podId, dto, user.id);
  }

  @Delete('operation-types/:opId/pods/:podId')
  @Roles(UserRoleName.HEAD_NURSE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a POD (Head Nurse only)' })
  @ApiResponse({ status: 204 })
  @ApiNotFoundResponse({ description: 'POD not found' })
  deletePod(
    @Param('opId', ParseIntPipe) opId: number,
    @Param('podId', ParseIntPipe) podId: number,
  ): Promise<void> {
    return this.service.deletePod(opId, podId);
  }
}
