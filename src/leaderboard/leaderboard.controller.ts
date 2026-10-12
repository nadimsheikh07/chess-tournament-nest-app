import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('leaderboard')
@ApiTags('Leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the player leaderboard',
    description:
      'Completed-match scoring is 1 point for a win, 0.5 for a draw, and 0 for a loss. Rankings sort by points, wins, rating, then name.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated leaderboard.',
    schema: {
      example: {
        data: [
          {
            rank: 1,
            userId: 'b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9',
            name: 'Nadim Sheikh',
            rating: 1216,
            gamesPlayed: 5,
            wins: 3,
            draws: 1,
            losses: 1,
            points: 3.5,
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid page or limit.' })
  findAll(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a player’s leaderboard standing' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Player user ID' })
  @ApiResponse({ status: 200, description: 'Leaderboard entry.' })
  @ApiResponse({ status: 404, description: 'Player not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaderboardService.findOne(id);
  }
}
