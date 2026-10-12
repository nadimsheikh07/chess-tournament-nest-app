import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { FindMatchmakingDto } from './dto/find-matchmaking.dto';
import { MatchmakingStatus } from './entities/matchmaking-status.enum';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
@ApiTags('Matchmaking')
@ApiBearerAuth()
export class MatchmakingController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly matchmakingGateway: MatchmakingGateway,
  ) {}

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
    return this.matchmakingService
      .join(request.user.userId)
      .then((result) => {
        if (result.match) {
          this.matchmakingGateway.notifyMatchFound(result.match);
        }
        return result;
      });
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
  @ApiOperation({
    summary: 'List queue entries with pagination, search, sorting, and filters (coach/admin only)',
  })
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
    description: 'Search queue ID, user ID, match ID, status, or rating',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['queuedAt', 'updatedAt', 'rating', 'status', 'userId'],
    example: 'queuedAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'ASC',
  })
  @ApiQuery({ name: 'status', required: false, enum: MatchmakingStatus })
  @ApiQuery({ name: 'userId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paginated matchmaking queue.' })
  @ApiResponse({ status: 400, description: 'Invalid pagination or filter values.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  findAll(@Req() request: AuthenticatedRequest, @Query() query: FindMatchmakingDto) {
    return this.matchmakingService.findAll(request.user.userId, query);
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
