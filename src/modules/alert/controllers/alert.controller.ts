import { Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
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

  @Get('doctor-notifications')
  @Roles(UserRoleName.DOCTOR)
  @ApiOperation({ summary: 'Get notifications of alerts handled by nurses for doctors' })
  @ApiResponse({ status: 200, type: PaginatedAlertsDto })
  getDoctorNotifications(@Query() query: QueryAlertDto): Promise<PaginatedAlertsDto> {
    return this.alertService.getDoctorNotifications(query);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({
    summary: 'Confirm that the assigned nurse handled a RED alert',
    description:
      'Only a nurse assigned to the patient room can confirm. The operation is idempotent and retains the first handler audit record.',
  })
  @ApiResponse({ status: 200, type: AlertResponseDto })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  handle(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: UserResponseDto,
  ): Promise<AlertResponseDto> {
    return this.alertService.handleAlert(id, caller);
  }
}
