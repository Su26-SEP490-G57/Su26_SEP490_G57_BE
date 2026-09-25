import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiProduces,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { assertOwnCaseForPatient } from 'src/shared/utils/assert-own-case';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { UserRoleName } from '../../user/enums/user-role.enum';
import {
  CreateTreatmentOrderDto,
  TreatmentOrderResponseDto,
  UpdateTreatmentOrderDto,
} from '../dtos/treatment-order.dto';
import { TreatmentSheetDto, TreatmentSheetPrefillDto } from '../dtos/treatment-sheet.dto';
import { TreatmentOrderService } from '../services/treatment-order.service';

@ApiTags('Treatment Orders')
@ApiBearerAuth()
@Controller('treatment-orders')
export class TreatmentOrderController {
  constructor(private readonly service: TreatmentOrderService) {}

  @Post()
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Write a "Phiếu theo dõi điều trị" with a care level (Doctor only)',
    description:
      "Sets the patient's active care level, auto-assigns the matching Care Observation Sheet to the nursing workflow, and stores the sheet in the HIS. If the HIS rejects the sheet nothing is saved.",
  })
  @ApiResponse({ status: 201, type: TreatmentOrderResponseDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  @ApiBadGatewayResponse({ description: 'HIS unreachable — order not saved' })
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

  @Get('patient/:caseId/sheet-prefill')
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Auto-filled fields for a new "Phiếu theo dõi điều trị"',
    description:
      'Patient header fields, next sheet number (from HIS) and "Diễn biến bệnh" seeded from the latest vital signs.',
  })
  @ApiResponse({ status: 200, type: TreatmentSheetPrefillDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  @ApiBadGatewayResponse({ description: 'HIS unreachable' })
  getSheetPrefill(@Param('caseId') caseId: string): Promise<TreatmentSheetPrefillDto> {
    return this.service.getSheetPrefill(caseId);
  }

  @Get('patient/:caseId/sheets')
  @Roles(UserRoleName.DOCTOR, UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.PATIENT)
  @ApiOperation({
    summary: '"Phiếu theo dõi điều trị" of a patient case from the HIS (newest first)',
  })
  @ApiResponse({ status: 200, type: [TreatmentSheetDto] })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  @ApiBadGatewayResponse({ description: 'HIS unreachable' })
  getSheets(
    @Param('caseId') caseId: string,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<TreatmentSheetDto[]> {
    assertOwnCaseForPatient(caller, caseId);
    return this.service.getSheets(caseId);
  }

  @Get('patient/:caseId/sheets/:sheetId/pdf')
  @Roles(UserRoleName.DOCTOR, UserRoleName.HEAD_NURSE, UserRoleName.NURSE, UserRoleName.PATIENT)
  @ApiOperation({ summary: 'Download one "Phiếu theo dõi điều trị" as PDF' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiNotFoundResponse({ description: 'Patient case or sheet not found' })
  @ApiBadGatewayResponse({ description: 'HIS unreachable' })
  async getSheetPdf(
    @Param('caseId') caseId: string,
    @Param('sheetId', ParseIntPipe) sheetId: number,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<StreamableFile> {
    assertOwnCaseForPatient(caller, caseId);
    const { file, fileName } = await this.service.getSheetPdf(caseId, sheetId);
    return new StreamableFile(file, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}
