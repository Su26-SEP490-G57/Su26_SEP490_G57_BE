import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../user/decorators/roles.decorator';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { RoomNurseAssignmentRepository } from '../repositories/room-nurse-assignment.repository';

@ApiTags('Nurses')
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

  @Post('bulk')
  @Roles(UserRoleName.HEAD_NURSE, UserRoleName.ADMIN)
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
    return { message: 'Bulk assignments updated successfully' };
  }
}
