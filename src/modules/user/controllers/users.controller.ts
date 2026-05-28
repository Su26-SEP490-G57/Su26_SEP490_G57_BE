import {
  Body, Controller, Delete, Get, Param,
  ParseIntPipe, Patch, Post, Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../dtos/create-user.dto';
import { QueryUserDto } from '../dtos/query-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a user account (Admin only)',
    description: 'Creates a new staff account. Password is bcrypt-hashed before storage. Returns no password_hash.',
  })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List users',
    description: 'Paginated user list. Filter by role=Nurse, role=Head_Nurse, or role=Admin.',
  })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user info',
    description: 'Update full_name, role, status, or password. New password is re-hashed automatically.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate user (soft delete)',
    description: 'Sets status = Inactive. Does not hard delete — id is referenced by alerts.handled_by.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.deactivate(id);
  }
}