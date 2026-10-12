import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { MatchmakingService } from './matchmaking.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
@ApiTags('Matchmaking')
@ApiBearerAuth()
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post()
  @ApiOperation({
    summary: 'Join the matchmaking queue',
    description:
      'Uses the player’s current Elo rating. Pairs with the closest eligible waiting player; the permitted rating gap widens over time.',
  })
  @ApiResponse({
    status: 201,
    description: 'Queue entry created; match is null if no eligible opponent is waiting.',
    schema: {
      example: {
        queueEntry: {
          id: '0f15fbc0-6617-4532-b649-9f6b8bd8f7a0',
          userId: 'b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9',
          rating: 1200,
          status: 'waiting',
          matchId: null,
        },
        match: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Player is already queued.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  join(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.join(request.user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get your latest matchmaking queue entry' })
  @ApiResponse({ status: 200, description: 'Latest queue entry.' })
  @ApiResponse({ status: 404, description: 'No queue entry found.' })
  getMine(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.getMine(request.user.userId);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Leave the active matchmaking queue' })
  @ApiResponse({ status: 200, description: 'Queue entry marked cancelled.' })
  @ApiResponse({ status: 404, description: 'No active queue entry found.' })
  leave(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.leave(request.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List queue entries (coach/admin only)' })
  @ApiResponse({ status: 200, description: 'Queue entries ordered by join time.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  findAll(@Req() request: AuthenticatedRequest) {
    return this.matchmakingService.findAll(request.user.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a queue entry by ID (owner or coach/admin)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Queue entry found.' })
  @ApiResponse({ status: 403, description: 'Entry belongs to another player.' })
  @ApiResponse({ status: 404, description: 'Queue entry not found.' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchmakingService.findOne(request.user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a queue entry (owner or coach/admin)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Queue entry deleted.' })
  @ApiResponse({ status: 400, description: 'Matched queue entries cannot be deleted.' })
  @ApiResponse({ status: 403, description: 'Entry belongs to another player.' })
  @ApiResponse({ status: 404, description: 'Queue entry not found.' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchmakingService.remove(request.user.userId, id);
  }
}
