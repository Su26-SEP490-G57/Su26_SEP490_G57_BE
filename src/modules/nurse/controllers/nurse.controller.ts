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
import { CreateNurseDto } from '../dtos/create-nurse.dto';
import { NurseResponseDto, PaginatedNursesDto } from '../dtos/nurse-response.dto';
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
