import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AcknowledgeAlertDto } from '../dtos/acknowledge-alert.dto';
import { AlertResponseDto, PaginatedAlertsDto } from '../dtos/alert-response.dto';
import { QueryAlertDto } from '../dtos/query-alert.dto';
import { AlertService } from '../services/alert.service';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @ApiOperation({
    summary: 'Get alerts with filters and pagination',
    description: 'Filter by caseId, status, alertType. Supports page/limit pagination.',
  })
  @ApiResponse({ status: 200, type: PaginatedAlertsDto })
  getAlerts(@Query() query: QueryAlertDto): Promise<PaginatedAlertsDto> {
    return this.alertService.getAlerts(query);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({
    summary: 'Acknowledge an alert',
    description: 'Marks the alert as Acknowledged.',
  })
  @ApiResponse({ status: 200, type: AlertResponseDto })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcknowledgeAlertDto,
  ): Promise<AlertResponseDto> {
    return this.alertService.acknowledgeAlert(id, dto);
  }
}
