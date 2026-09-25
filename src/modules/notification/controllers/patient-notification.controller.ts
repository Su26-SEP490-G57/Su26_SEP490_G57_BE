import { Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import {
  PatientNotificationResponseDto,
  QueryPatientNotificationDto,
} from '../dtos/patient-notification.dto';
import { PatientNotificationService } from '../services/patient-notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class PatientNotificationController {
  constructor(private readonly service: PatientNotificationService) {}

  @Get('mine')
  @Roles(UserRoleName.PATIENT)
  @ApiOperation({
    summary: "List the caller patient's own in-app notifications (newest first, max 50)",
  })
  @ApiResponse({ status: 200, type: [PatientNotificationResponseDto] })
  listMine(
    @CurrentUser() user: UserResponseDto,
    @Query() query: QueryPatientNotificationDto,
  ): Promise<PatientNotificationResponseDto[]> {
    return this.service.listForPatient(user.caseId!, query.category);
  }

  @Patch(':id/read')
  @Roles(UserRoleName.PATIENT)
  @ApiOperation({ summary: "Mark one of the caller patient's own notifications as read" })
  @ApiResponse({ status: 200, type: PatientNotificationResponseDto })
  markAsRead(
    @CurrentUser() user: UserResponseDto,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PatientNotificationResponseDto> {
    return this.service.markAsRead(id, user.caseId!);
  }
}
