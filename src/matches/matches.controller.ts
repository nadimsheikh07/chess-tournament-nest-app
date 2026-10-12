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
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { FindMatchesDto } from './dto/find-matches.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchResult } from './entities/match-result.enum';
import { MatchStatus } from './entities/match-status.enum';
import { PlayMoveDto } from './dto/play-move.dto';
import { MatchmakingGateway } from '../matchmaking/matchmaking.gateway';

@Controller('matches')
@UseGuards(JwtAuthGuard)
@ApiTags('Matches')
@ApiBearerAuth()
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly matchmakingGateway: MatchmakingGateway,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a standalone chess match (coach/admin only)',
    description:
      'Tournament match pairings are generated automatically and cannot be created manually.',
  })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({ status: 201, description: 'Match created.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid players, status, result, or tournament pairing request.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({ status: 404, description: 'Player or tournament not found.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createMatchDto: CreateMatchDto,
  ) {
    return this.matchesService.create(request.user.userId, createMatchDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List matches with pagination, search, sorting, and filters',
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
    description:
      'Search match ID, player IDs, tournament ID, status, or result',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'createdAt',
      'updatedAt',
      'completedAt',
      'status',
      'result',
      'whitePlayerId',
      'blackPlayerId',
    ],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus })
  @ApiQuery({ name: 'result', required: false, enum: MatchResult })
  @ApiQuery({ name: 'tournamentId', required: false, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Paginated matches and page metadata.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination or filter values.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  findAll(@Query() query: FindMatchesDto) {
    return this.matchesService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'List your match history' })
  @ApiResponse({
    status: 200,
    description: 'Paginated matches for the player.',
  })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: FindMatchesDto,
  ) {
    return this.matchesService.findAll(query, request.user.userId);
  }

  @Get(':id/game')
  @ApiOperation({
    summary: 'Get a game state, clocks, PGN, and legal moves',
    description:
      'Players, coaches, and admins can read the authoritative game state. Only players receive legal moves.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getGameState(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const state = await this.matchesService.getGameState(
      request.user.userId,
      id,
    );
    if (state.clockExpired) {
      this.matchmakingGateway.notifyGameUpdated(state.match);
    }
    const { clockExpired, ...publicState } = state;
    void clockExpired;
    return publicState;
  }

  @Post(':id/draw-offer')
  @ApiOperation({ summary: 'Offer a draw to your opponent' })
  async offerDraw(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const match = await this.matchesService.offerDraw(
      request.user.userId,
      id,
    );
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Post(':id/draw-offer/accept')
  @ApiOperation({ summary: 'Accept your opponent’s draw offer' })
  async acceptDraw(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const match = await this.matchesService.respondToDraw(
      request.user.userId,
      id,
      true,
    );
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Post(':id/draw-offer/decline')
  @ApiOperation({ summary: 'Decline your opponent’s draw offer' })
  async declineDraw(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const match = await this.matchesService.respondToDraw(
      request.user.userId,
      id,
      false,
    );
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Post(':id/draw-offer/cancel')
  @ApiOperation({ summary: 'Cancel your pending draw offer' })
  async cancelDrawOffer(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const match = await this.matchesService.cancelDrawOffer(
      request.user.userId,
      id,
    );
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Post(':id/moves')
  @ApiOperation({ summary: 'Submit a legal move in your match' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async playMove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlayMoveDto,
  ) {
    const match = await this.matchesService.playMove(
      request.user.userId,
      id,
      dto,
    );
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Post(':id/resign')
  @ApiOperation({
    summary: 'Resign from your match',
    description:
      'Ends the match, records the result, and recalculates ratings.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async resign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const match = await this.matchesService.resign(request.user.userId, id);
    this.matchmakingGateway.notifyGameUpdated(match);
    return match;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a match by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Match found.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a match (coach/admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({
    status: 200,
    description: 'Match updated; player ratings recalculated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid match status or result.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({
    status: 404,
    description: 'Match, player, or tournament not found.',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchDto: UpdateMatchDto,
  ) {
    return this.matchesService.update(request.user.userId, id, updateMatchDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a match (coach/admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Match deleted; player ratings recalculated.',
  })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchesService.remove(request.user.userId, id);
  }
}
