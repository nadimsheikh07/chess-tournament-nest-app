import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import {
  DEFAULT_MATCH_CLOCK_MS,
  Match,
} from '../matches/entities/match.entity';
import { MatchStatus } from '../matches/entities/match-status.enum';
import { User } from '../users/entities/user.entity';
import { Matchmaking } from './entities/matchmaking.entity';
import { MatchmakingStatus } from './entities/matchmaking-status.enum';
import { FindMatchmakingDto } from './dto/find-matchmaking.dto';

@Injectable()
export class MatchmakingService {
  constructor(
    @InjectRepository(Matchmaking)
    private readonly queue: Repository<Matchmaking>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async join(userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.role !== UserRole.PLAYER) {
        throw new ForbiddenException('Only students can join matchmaking');
      }

      const queueRepository = manager.getRepository(Matchmaking);
      const existing = await queueRepository.findOne({
        where: { userId, status: MatchmakingStatus.WAITING },
      });
      if (existing) {
        throw new BadRequestException('You are already waiting for a match');
      }
      const activeMatch = await manager.getRepository(Match).findOne({
        where: [
          {
            whitePlayerId: userId,
            status: In([MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS]),
          },
          {
            blackPlayerId: userId,
            status: In([MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS]),
          },
        ],
      });
      if (activeMatch) {
        throw new BadRequestException(
          'Finish your current match before finding another opponent',
        );
      }

      const entry = await queueRepository.save(
        queueRepository.create({
          userId,
          rating: user.rating,
          status: MatchmakingStatus.WAITING,
        }),
      );

      const waitingEntries = await queueRepository.find({
        where: { status: MatchmakingStatus.WAITING },
        order: { queuedAt: 'ASC' },
      });
      const now = Date.now();
      const candidates = waitingEntries
        .filter((candidate) => candidate.id !== entry.id)
        .map((candidate) => ({
          candidate,
          difference: Math.abs(candidate.rating - entry.rating),
          allowedDifference: Math.min(
            this.ratingWindow(candidate.queuedAt, now),
            this.ratingWindow(entry.queuedAt, now),
          ),
        }))
        .filter(
          ({ difference, allowedDifference }) =>
            difference <= allowedDifference,
        )
        .sort(
          (a, b) =>
            a.difference - b.difference ||
            a.candidate.queuedAt.getTime() - b.candidate.queuedAt.getTime(),
        );

      for (const { candidate } of candidates) {
        const lockedCandidate = await queueRepository.findOne({
          where: { id: candidate.id, status: MatchmakingStatus.WAITING },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedCandidate) {
          continue;
        }

        const matchRepository = manager.getRepository(Match);
        const match = await matchRepository.save(
          matchRepository.create({
            whitePlayerId: lockedCandidate.userId,
            blackPlayerId: entry.userId,
            tournamentId: null,
            status: MatchStatus.IN_PROGRESS,
            result: null,
            pgn: null,
            whiteTimeMs: DEFAULT_MATCH_CLOCK_MS,
            blackTimeMs: DEFAULT_MATCH_CLOCK_MS,
            clockStartedAt: new Date(),
            endReason: null,
            completedAt: null,
          }),
        );

        lockedCandidate.status = MatchmakingStatus.MATCHED;
        lockedCandidate.matchId = match.id;
        entry.status = MatchmakingStatus.MATCHED;
        entry.matchId = match.id;
        await queueRepository.save([lockedCandidate, entry]);

        return { queueEntry: entry, match };
      }

      return { queueEntry: entry, match: null };
    });
  }

  async getMine(userId: string) {
    const entry = await this.queue.findOne({
      where: { userId },
      order: { queuedAt: 'DESC' },
    });
    if (!entry) {
      throw new NotFoundException('No matchmaking entry found');
    }

    return entry;
  }

  async leave(userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.getRepository(Matchmaking).findOne({
        where: { userId, status: MatchmakingStatus.WAITING },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry) {
        throw new NotFoundException('No active queue entry found');
      }

      entry.status = MatchmakingStatus.CANCELLED;
      return manager.getRepository(Matchmaking).save(entry);
    });
  }

  async findAll(actorId: string, query: FindMatchmakingDto) {
    await this.assertManager(actorId);
    const sortColumns = {
      queuedAt: 'entry.queuedAt',
      updatedAt: 'entry.updatedAt',
      rating: 'entry.rating',
      status: 'entry.status',
      userId: 'entry.userId',
    } as const;
    const sortColumn =
      sortColumns[query.sortBy as keyof typeof sortColumns] ??
      sortColumns.queuedAt;
    const sortOrder = query.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const queryBuilder = this.queue.createQueryBuilder('entry');

    if (query.search?.trim()) {
      const search = query.search.trim();
      const numericSearch = Number(search);
      queryBuilder.andWhere(
        `(
          CAST(entry.id AS text) ILIKE :search
          OR CAST(entry.userId AS text) ILIKE :search
          OR CAST(entry.matchId AS text) ILIKE :search
          OR CAST(entry.status AS text) ILIKE :search
          ${Number.isInteger(numericSearch) ? 'OR entry.rating = :rating' : ''}
        )`,
        {
          search: `%${search}%`,
          ...(Number.isInteger(numericSearch) ? { rating: numericSearch } : {}),
        },
      );
    }
    if (query.status) {
      queryBuilder.andWhere('entry.status = :status', {
        status: query.status,
      });
    }
    if (query.userId) {
      queryBuilder.andWhere('entry.userId = :userId', {
        userId: query.userId,
      });
    }

    queryBuilder
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('entry.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findOne(actorId: string, id: string) {
    const entry = await this.queue.findOneBy({ id });
    if (!entry) {
      throw new NotFoundException('Matchmaking entry not found');
    }
    if (entry.userId !== actorId) {
      await this.assertManager(actorId);
    }
    return entry;
  }

  async remove(actorId: string, id: string) {
    const entry = await this.queue.findOneBy({ id });
    if (!entry) {
      throw new NotFoundException('Matchmaking entry not found');
    }
    if (entry.userId !== actorId) {
      await this.assertManager(actorId);
    }
    if (entry.status === MatchmakingStatus.MATCHED) {
      throw new BadRequestException('A matched queue entry cannot be deleted');
    }
    await this.queue.remove(entry);
    return { deleted: true, id };
  }

  private ratingWindow(queuedAt: Date, now: number) {
    const minutesWaiting = Math.floor((now - queuedAt.getTime()) / 60_000);
    return Math.min(100 + minutesWaiting * 50, 800);
  }

  private async assertManager(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.COACH && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only coaches and admins can manage the queue',
      );
    }
  }
}
