import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user (admin only)' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.usersService.adminCreate(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated users returned without credentials.',
  })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiQuery({ name: 'page', required: false, example: 1, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search user name, email, or role',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'email', 'role', 'rating', 'createdAt', 'updatedAt'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindUsersDto,
  ) {
    return this.usersService.adminFindAll(req.user.userId, query);
  }

  /**
   * GET /api/v1/users/me
   * Get the authenticated user's profile.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get your profile, role, and rating' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile.' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * PATCH /api/v1/users/me
   * Update the authenticated user's profile.
   */
  @Patch('me')
  @ApiOperation({
    summary: 'Update your profile',
    description: 'Name and email only. Role and rating are not user-editable.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  /**
   * GET /api/v1/users/me/matches
   * Get matches for the authenticated user.
   */
  @Get('me/matches')
  getMyMatches(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMyMatches(req.user.userId);
  }

  /**
   * GET /api/v1/users/me/schedule
   * Get the authenticated user's tournament schedule.
   */
  @Get('me/schedule')
  getMySchedule(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMySchedule(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID (admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User returned without credentials.',
  })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.adminFindOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user, including role (admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.adminUpdate(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  @ApiResponse({
    status: 403,
    description: 'Cannot delete yourself or the last admin.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.adminDelete(req.user.userId, id);
  }
}
