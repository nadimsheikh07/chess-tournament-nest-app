import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users/me
   * Get the authenticated user's profile.
   */
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * PATCH /api/v1/users/me
   * Update the authenticated user's profile.
   */
  @Patch('me')
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
}
