import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { FindTournamentsDto } from './dto/find-tournaments.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Tournaments')
@ApiBearerAuth()
@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new Error('User ID missing from JWT payload');
    }

    return userId;
  }

  private assertCoach(req: AuthenticatedRequest) {
    const role = req.user?.role?.toLowerCase();

    if (role !== 'coach' && role !== 'admin') {
      throw new ForbiddenException('Only coaches can manage tournaments');
    }
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTournamentDto) {
    this.assertCoach(req);
    return this.tournamentsService.create(this.getUserId(req), dto);
  }

  @Post(':id/start')
  @ApiOperation({
    summary: 'Start an open tournament and create the first Swiss round',
  })
  start(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertCoach(req);
    return this.tournamentsService.start(id, this.getUserId(req));
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tournaments',
    description:
      'Retrieve tournaments with pagination, search, sorting, and status filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tournaments retrieved successfully.',
    schema: {
      example: {
        data: [
          {
            id: 'a1b2c3d4-1234-4567-8901-123456789abc',
            name: 'Kingdom Chess Championship',
            description: 'Open chess tournament',
            status: 'open',
            timeControl: '5+0',
            maxParticipants: 16,
            startDate: '2026-11-15T10:00:00.000Z',
            endDate: '2026-11-15T18:00:00.000Z',
          },
        ],
        meta: {
          total: 24,
          page: 1,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  findAll(@Query() query: FindTournamentsDto) {
    return this.tournamentsService.findAll(query);
  }

  @Get('my-schedule')
  getMySchedule(@Req() req: AuthenticatedRequest) {
    return this.tournamentsService.getMySchedule(this.getUserId(req));
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    this.assertCoach(req);

    return this.tournamentsService.update(id, this.getUserId(req), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft or open tournament (coach/admin)' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertCoach(req);
    return this.tournamentsService.remove(id, this.getUserId(req));
  }

  @Post(':id/join')
  join(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tournamentsService.join(id, this.getUserId(req));
  }

  @Get(':id/participants')
  getParticipants(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.getParticipants(id);
  }

  @Get(':id/matches')
  getMatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.getMatches(id);
  }

  @Get(':id/leaderboard')
  getLeaderboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.getLeaderboard(id);
  }

  @Get(':id/winner')
  getWinner(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.getWinner(id);
  }
}
