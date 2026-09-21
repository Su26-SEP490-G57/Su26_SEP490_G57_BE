import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateVitalSignDto } from '../dtos/create-vital-sign.dto';
import { QueryVitalSignDto } from '../dtos/query-vital-sign.dto';
import { PaginatedVitalSignsDto, VitalSignResponseDto } from '../dtos/vital-sign-response.dto';
import { VitalSignsService } from '../services/vital-signs.service';

@ApiTags('Vital Signs')
@ApiBearerAuth()
@Controller('vital-signs')
export class VitalSignsController {
  constructor(private readonly service: VitalSignsService) {}

  @Post()
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({
    summary: 'Record a set of vital signs for a patient case',
    description:
      'Timestamp and recorder identity are always derived server-side from the authenticated user — the body has no such fields.',
  })
  @ApiResponse({ status: 201, type: VitalSignResponseDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  create(
    @Body() dto: CreateVitalSignDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<VitalSignResponseDto> {
    return this.service.create(dto, user);
  }

  @Get('patient/:caseId')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR)
  @ApiOperation({ summary: 'Paginated vital-signs history for a patient case (newest first)' })
  @ApiResponse({ status: 200, type: PaginatedVitalSignsDto })
  @ApiNotFoundResponse({ description: 'Patient case not found' })
  getByCaseId(
    @Param('caseId') caseId: string,
    @Query() query: QueryVitalSignDto,
  ): Promise<PaginatedVitalSignsDto> {
    return this.service.getByCaseId(caseId, query);
  }
}
