import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchResult } from '../matches/entities/match-result.enum';
import { Match } from '../matches/entities/match.entity';
import { MatchStatus } from '../matches/entities/match-status.enum';
import { User } from '../users/entities/user.entity';
import { LeaderboardEntry } from './entities/leaderboard.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Match)
    private readonly matches: Repository<Match>,
  ) {}

  async findAll(page = '1', limit = '50') {
    const pageNumber = this.parsePositiveInteger(page, 'page');
    const pageSize = this.parsePositiveInteger(limit, 'limit');
    if (pageSize > 100) {
      throw new BadRequestException('limit cannot exceed 100');
    }

    const entries = await this.buildLeaderboard();
    const offset = (pageNumber - 1) * pageSize;

    return {
      data: entries.slice(offset, offset + pageSize),
      meta: {
        total: entries.length,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(entries.length / pageSize),
      },
    };
  }

  async findOne(userId: string): Promise<LeaderboardEntry> {
    const entries = await this.buildLeaderboard();
    const entry = entries.find((candidate) => candidate.userId === userId);
    if (!entry) {
      throw new NotFoundException('Leaderboard entry not found');
    }
    return entry;
  }

  private async buildLeaderboard(): Promise<LeaderboardEntry[]> {
    const [users, matches] = await Promise.all([
      this.users.find({ select: { id: true, name: true, rating: true } }),
      this.matches.find({
        where: { status: MatchStatus.COMPLETED },
        select: {
          whitePlayerId: true,
          blackPlayerId: true,
          result: true,
        },
      }),
    ]);

    const statistics = new Map<string, Omit<LeaderboardEntry, 'rank'>>();
    for (const user of users) {
      statistics.set(user.id, {
        userId: user.id,
        name: user.name,
        rating: user.rating,
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
      });
    }

    for (const match of matches) {
      const white = statistics.get(match.whitePlayerId);
      const black = statistics.get(match.blackPlayerId);
      if (!white || !black || !match.result) {
        continue;
      }
      white.gamesPlayed += 1;
      black.gamesPlayed += 1;
      if (match.result === MatchResult.DRAW) {
        white.draws += 1;
        black.draws += 1;
        white.points += 1;
        black.points += 1;
      } else if (match.result === MatchResult.WHITE_WIN) {
        white.wins += 1;
        black.losses += 1;
        white.points += 3;
      } else {
        black.wins += 1;
        white.losses += 1;
        black.points += 3;
      }
    }

    return [...statistics.values()]
      .sort(
        (a, b) =>
          b.rating - a.rating ||
          b.points - a.points ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name),
      )
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  private parsePositiveInteger(value: string, field: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return parsed;
  }
}
