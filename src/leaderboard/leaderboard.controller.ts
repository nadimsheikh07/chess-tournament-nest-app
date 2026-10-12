import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('leaderboard')
@ApiTags('Leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the rated player leaderboard',
    description:
      'Rankings and win/draw/loss statistics are calculated from completed matches.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50, minimum: 1, maximum: 100 })
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
            points: 10,
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid page or limit.' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.leaderboardService.findAll(page, limit);
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
