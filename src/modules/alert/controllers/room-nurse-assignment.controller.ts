import { Body, Controller, Get, Param, Put, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';

@ApiTags('Alerts')
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nurseIds: { type: 'array', items: { type: 'number' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Assignments updated successfully' })
  async assignNurses(
    @Param('roomCode') roomCode: string,
    @Body('nurseIds') nurseIds: number[],
  ): Promise<{ message: string; roomCode: string }> {
    if (!Array.isArray(nurseIds)) {
      throw new BadRequestException('nurseIds must be an array of numbers');
    }
    await this.repository.replaceAssignments(roomCode.trim().toUpperCase(), nurseIds);
    return { message: 'Assignments updated successfully', roomCode: roomCode.trim().toUpperCase() };
  }
}
