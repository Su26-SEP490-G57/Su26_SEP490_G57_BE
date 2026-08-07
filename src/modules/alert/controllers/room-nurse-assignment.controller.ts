import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';

@ApiTags('Room Nurse Assignments')
@ApiBearerAuth()
@Controller('room-nurse-assignments')
export class RoomNurseAssignmentController {
  constructor(private readonly repository: RoomNurseAssignmentRepository) {}

  @Get(':roomCode')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.ADMIN)
  @ApiOperation({ summary: 'Get assigned nurses for a room' })
  @ApiResponse({ status: 200, type: [Number] })
  async getAssignedNurses(@Param('roomCode') roomCode: string): Promise<number[]> {
    return this.repository.getAssignedNurses(roomCode.trim().toUpperCase());
  }

  @Put(':roomCode')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.ADMIN)
  @ApiOperation({ summary: 'Assign nurses to a room' })
  @ApiResponse({ status: 200 })
  async assignNurses(
    @Param('roomCode') roomCode: string,
    @Body('nurseIds') nurseIds: number[],
  ): Promise<void> {
    return this.repository.replaceAssignments(roomCode.trim().toUpperCase(), nurseIds);
  }
}
