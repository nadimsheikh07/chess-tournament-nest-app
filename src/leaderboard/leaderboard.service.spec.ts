import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { MatchResult } from '../matches/entities/match-result.enum';
import { MatchStatus } from '../matches/entities/match-status.enum';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    const users = {
      find: vi.fn().mockResolvedValue([
        { id: 'white', name: 'White', rating: 1100 },
        { id: 'black', name: 'Black', rating: 2000 },
        { id: 'draw-player', name: 'Draw Player', rating: 1500 },
      ]),
    };
    const matches = {
      find: vi.fn().mockResolvedValue([
        {
          whitePlayerId: 'white',
          blackPlayerId: 'black',
          result: MatchResult.WHITE_WIN,
          status: MatchStatus.COMPLETED,
        },
        {
          whitePlayerId: 'black',
          blackPlayerId: 'draw-player',
          result: MatchResult.DRAW,
          status: MatchStatus.COMPLETED,
        },
      ]),
    };

    service = new LeaderboardService(
      users as unknown as Repository<User>,
      matches as unknown as Repository<Match>,
    );
  });

  it('scores wins as 1 and draws as 0.5, then ranks points before the tiebreaks', async () => {
    const result = await service.findAll(
      Object.assign(new LeaderboardQueryDto(), { page: 1, limit: 10 }),
    );

    expect(result.data).toEqual([
      expect.objectContaining({
        userId: 'white',
        rank: 1,
        points: 1,
        wins: 1,
        draws: 0,
        losses: 0,
      }),
      expect.objectContaining({
        userId: 'black',
        rank: 2,
        points: 0.5,
        wins: 0,
        draws: 1,
        losses: 1,
      }),
      expect.objectContaining({
        userId: 'draw-player',
        rank: 3,
        points: 0.5,
        wins: 0,
        draws: 1,
        losses: 0,
      }),
    ]);
  });
});
