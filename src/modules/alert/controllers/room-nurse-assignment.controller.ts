import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { NurseGateway } from '../../nurse/gateways/nurse.gateway';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';
import { AuditLog } from '../../audit-log/decorators/audit-log.decorator';

@ApiTags('Nurses')
@ApiBearerAuth()
@Controller('room-nurse-assignments')
export class RoomNurseAssignmentController {
  constructor(
    private readonly repository: RoomNurseAssignmentRepository,
    private readonly nurseGateway: NurseGateway,
  ) {}

  @Get(':roomCode')
  @Roles(UserRoleName.NURSE, UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR, UserRoleName.ADMIN)
  @ApiOperation({ summary: 'Get assigned nurses for a room' })
  @ApiResponse({ status: 200, type: [Number] })
  async getAssignedNurses(@Param('roomCode') roomCode: string): Promise<number[]> {
    return this.repository.getAssignedNurses(roomCode.trim().toUpperCase());
  }

  @Post('bulk')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.DOCTOR, UserRoleName.ADMIN)
  @AuditLog({
    action: 'CREATE',
    entityType: 'room-nurse-assignments',
    getEntityId: () => 'bulk',

    getChanges: (req: any) => ({
      after: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        roomCodes: (req.body as { roomCodes?: string[] }).roomCodes,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        nurseIds: (req.body as { nurseIds?: number[] }).nurseIds,
      },
    }),
  })
  @ApiOperation({ summary: 'Assign nurses to multiple rooms' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roomCodes: { type: 'array', items: { type: 'string' } },
        nurseIds: { type: 'array', items: { type: 'number' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bulk assignments updated successfully' })
  async bulkAssign(
    @Body('roomCodes') roomCodes: string[],
    @Body('nurseIds') nurseIds: number[],
  ): Promise<{ message: string }> {
    const normalizedCodes = roomCodes.map((c) => c.trim().toUpperCase());
    await this.repository.bulkAssign(normalizedCodes, nurseIds);
    this.nurseGateway.emitRoomAssignmentsChanged();
    return { message: 'Bulk assignments updated successfully' };
  }
}
