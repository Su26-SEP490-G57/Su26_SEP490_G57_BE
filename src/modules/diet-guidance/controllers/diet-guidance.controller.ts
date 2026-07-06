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
  UseGuards,
} from '@nestjs/common';
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
import { UserRole } from '../../user/enums/user-role.enum';
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
import { DietGuidanceService } from '../services/diet-guidance.service';

@ApiTags('Diet Guidance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diet-guidance')
export class DietGuidanceController {
  constructor(private readonly service: DietGuidanceService) {}

  // ── Operation Types ──────────────────────────────────────────────────────────

  @Get('operation-types')
  @ApiOperation({ summary: 'List all operation types with POD count' })
  @ApiResponse({ status: 200, type: [OperationTypeResponseDto] })
  getOperationTypes(): Promise<OperationTypeResponseDto[]> {
    return this.service.getOperationTypes();
  }

  @Post('operation-types')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
  @ApiOperation({ summary: 'Create a new operation type (Head Nurse only)' })
  @ApiResponse({ status: 201, type: OperationTypeResponseDto })
  createOperationType(@Body() dto: CreateOperationTypeDto): Promise<OperationTypeResponseDto> {
    return this.service.createOperationType(dto);
  }

  @Patch('operation-types/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_NURSE)
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
