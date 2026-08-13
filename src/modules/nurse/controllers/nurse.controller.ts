import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { AssignNurseRoomsDto } from '../dtos/assign-nurse-rooms.dto';
import { CreateNurseDto } from '../dtos/create-nurse.dto';
import { NurseResponseDto, PaginatedNursesDto } from '../dtos/nurse-response.dto';
import {
  HospitalRoomSummaryDto,
  NurseRoomAssignmentResponseDto,
} from '../dtos/nurse-room-assignment-response.dto';
import { QueryNurseDto } from '../dtos/query-nurse.dto';
import { UpdateNurseDto } from '../dtos/update-nurse.dto';
import { NurseService } from '../services/nurse.service';

class NurseStatsDto {
  @ApiProperty({ example: 3 }) total!: number;
  @ApiProperty({ example: 2 }) active!: number;
  @ApiProperty({ example: 1 }) inactive!: number;
}

@ApiTags('Nurses')
@ApiBearerAuth()
@Controller('nurses')
export class NurseController {
  constructor(private readonly nurseService: NurseService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get nurse count stats (total, active, inactive)' })
  @ApiResponse({ status: 200, type: NurseStatsDto })
  getStats() {
    return this.nurseService.getStats();
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Get list of all hospital rooms with active patient count' })
  @ApiResponse({ status: 200, type: [HospitalRoomSummaryDto] })
  getAllHospitalRooms() {
    return this.nurseService.getAllHospitalRooms();
  }

  @Get('me/assigned-rooms')
  @ApiOperation({ summary: 'Get assigned rooms for currently authenticated nurse' })
  getAssignedRoomsForMe(@CurrentUser() user: { id: number }) {
    return this.nurseService.getAssignedRooms(user.id);
  }

  @Get(':id/assigned-rooms')
  @ApiOperation({ summary: 'Get assigned rooms for a specific nurse' })
  getAssignedRoomsForNurse(@Param('id', ParseIntPipe) id: number) {
    return this.nurseService.getAssignedRooms(id);
  }

  @Post(':id/assign-rooms')
  @ApiOperation({ summary: 'Assign rooms to a nurse' })
  @ApiResponse({ status: 200, type: NurseRoomAssignmentResponseDto })
  assignRooms(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignNurseRoomsDto) {
    return this.nurseService.assignRooms(id, dto.roomCodes);
  }

  @Delete(':id/rooms/:roomCode')
  @ApiOperation({ summary: 'Remove a specific room assignment from a nurse' })
  removeRoomAssignment(@Param('id', ParseIntPipe) id: number, @Param('roomCode') roomCode: string) {
    return this.nurseService.removeRoomAssignment(id, roomCode);
  }

  @Get()
  @ApiOperation({ summary: 'Get nurse list with pagination, search and isActive filter' })
  @ApiResponse({ status: 200, type: PaginatedNursesDto })
  getNurses(@Query() query: QueryNurseDto): Promise<PaginatedNursesDto> {
    return this.nurseService.getNurses(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get nurse by ID' })
  @ApiResponse({ status: 200, type: NurseResponseDto })
  @ApiNotFoundResponse({ description: 'Nurse not found' })
  getNurseById(@Param('id', ParseIntPipe) id: number): Promise<NurseResponseDto> {
    return this.nurseService.getNurseById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new nurse account' })
  @ApiResponse({ status: 201, type: NurseResponseDto })
  createNurse(@Body() dto: CreateNurseDto): Promise<NurseResponseDto> {
    return this.nurseService.createNurse(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update nurse info' })
  @ApiResponse({ status: 200, type: NurseResponseDto })
  @ApiNotFoundResponse({ description: 'Nurse not found' })
  updateNurse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNurseDto,
  ): Promise<NurseResponseDto> {
    return this.nurseService.updateNurse(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete nurse (deactivate)' })
  @ApiResponse({ status: 200, type: NurseResponseDto })
  @ApiNotFoundResponse({ description: 'Nurse not found' })
  deleteNurse(@Param('id', ParseIntPipe) id: number): Promise<NurseResponseDto> {
    return this.nurseService.deleteNurse(id);
  }
}
