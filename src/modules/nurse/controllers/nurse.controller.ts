import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateNurseDto } from '../dtos/create-nurse.dto';
import { NurseResponseDto, PaginatedNursesDto } from '../dtos/nurse-response.dto';
import { QueryNurseDto } from '../dtos/query-nurse.dto';
import { UpdateNurseDto } from '../dtos/update-nurse.dto';
import { NurseService } from '../services/nurse.service';

@ApiTags('Nurses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nurses')
export class NurseController {
  constructor(private readonly nurseService: NurseService) {}

  @Get()
  @ApiOperation({ summary: 'Get nurse list' })
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
