import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('Authentication')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user and role' })
  async getMe(@Req() request: AuthenticatedRequest) {
    const profile = await this.usersService.getProfile(request.user.userId);
    return {
      userId: profile.id,
      email: profile.email,
      role: profile.role,
    };
  }
}
