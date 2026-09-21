import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
  CreateTreatmentOrderDto,
  TreatmentOrderResponseDto,
  UpdateTreatmentOrderDto,
} from '../dtos/treatment-order.dto';
import { TreatmentOrderService } from '../services/treatment-order.service';

@ApiTags('Treatment Orders')
@ApiBearerAuth()
@Controller('treatment-orders')
export class TreatmentOrderController {
  constructor(private readonly service: TreatmentOrderService) {}

  @Post()
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Create a treatment order (Doctor only)',
    description:
      "Sets the patient's active care level and auto-assigns the matching Care Observation Sheet to the nursing workflow.",
  })
  @ApiResponse({ status: 201, type: TreatmentOrderResponseDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  create(
    @Body() dto: CreateTreatmentOrderDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<TreatmentOrderResponseDto> {
    return this.service.createOrder(dto, user);
  }

  @Patch(':id')
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Amend the currently active treatment order (Doctor only)',
    description: 'Superseded orders are immutable — amending one returns 409.',
  })
  @ApiResponse({ status: 200, type: TreatmentOrderResponseDto })
  @ApiNotFoundResponse({ description: 'Treatment order not found' })
  @ApiConflictResponse({ description: 'Treatment order is no longer the active one' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTreatmentOrderDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<TreatmentOrderResponseDto> {
    return this.service.updateOrder(id, dto, user);
  }

  @Get('patient/:caseId')
  @Roles(UserRoleName.DOCTOR, UserRoleName.HEAD_NURSE, UserRoleName.NURSE)
  @ApiOperation({ summary: 'Treatment order history for a patient case (newest first)' })
  @ApiResponse({ status: 200, type: [TreatmentOrderResponseDto] })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  getByCaseId(@Param('caseId') caseId: string): Promise<TreatmentOrderResponseDto[]> {
    return this.service.getByCaseId(caseId);
  }
}
