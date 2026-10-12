import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Chess } from 'chess.js';
import { UserRole } from '../common/enums/user-role.enum';
import {
  Tournament,
  TournamentStatus,
} from '../tournaments/entities/tournament.entity';
import { TournamentPairingService } from '../tournaments/tournament-pairing.service';
import { User } from '../users/entities/user.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { FindMatchesDto } from './dto/find-matches.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchResult } from './entities/match-result.enum';
import { Match } from './entities/match.entity';
import { MatchStatus } from './entities/match-status.enum';
import { PlayMoveDto } from './dto/play-move.dto';

@Injectable()
export class MatchesService {
  private readonly initialRating = 1200;
  private readonly kFactor = 32;

  constructor(
    @InjectRepository(Match)
    private readonly matches: Repository<Match>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly dataSource: DataSource,
    private readonly tournamentPairing: TournamentPairingService,
  ) {}

  async create(actorId: string, dto: CreateMatchDto) {
    await this.assertManager(actorId);
    this.validateMatch(
      dto.whitePlayerId,
      dto.blackPlayerId,
      dto.status,
      dto.result ?? undefined,
    );
    await this.assertPlayersExist(dto.whitePlayerId, dto.blackPlayerId);

    return this.dataSource.transaction(async (manager) => {
      const match = manager.getRepository(Match).create({
        ...dto,
        tournamentId: null,
        roundNumber: null,
        status: dto.status ?? MatchStatus.SCHEDULED,
        result: dto.result ?? null,
        pgn: dto.pgn ?? null,
        completedAt:
          dto.status === MatchStatus.COMPLETED ? new Date() : null,
      });
      const saved = await manager.getRepository(Match).save(match);
      await this.recalculateRatings(manager);
      return saved;
    });
  }

  async findAll(query: FindMatchesDto, playerId?: string) {
    const sortColumns = {
      createdAt: 'match.createdAt',
      updatedAt: 'match.updatedAt',
      completedAt: 'match.completedAt',
      status: 'match.status',
      result: 'match.result',
      whitePlayerId: 'match.whitePlayerId',
      blackPlayerId: 'match.blackPlayerId',
    } as const;
    const sortColumn =
      sortColumns[query.sortBy as keyof typeof sortColumns] ??
      sortColumns.createdAt;
    const sortOrder = query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const queryBuilder = this.matches.createQueryBuilder('match');

    if (playerId) {
      queryBuilder.andWhere(
        '(match.whitePlayerId = :playerId OR match.blackPlayerId = :playerId)',
        { playerId },
      );
    }
    if (query.search?.trim()) {
      queryBuilder.andWhere(
        `(
          CAST(match.id AS text) ILIKE :search
          OR CAST(match.whitePlayerId AS text) ILIKE :search
          OR CAST(match.blackPlayerId AS text) ILIKE :search
          OR CAST(match.tournamentId AS text) ILIKE :search
          OR CAST(match.status AS text) ILIKE :search
          OR CAST(match.result AS text) ILIKE :search
        )`,
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.status) {
      queryBuilder.andWhere('match.status = :status', {
        status: query.status,
      });
    }
    if (query.result) {
      queryBuilder.andWhere('match.result = :result', {
        result: query.result,
      });
    }
    if (query.tournamentId) {
      queryBuilder.andWhere('match.tournamentId = :tournamentId', {
        tournamentId: query.tournamentId,
      });
    }

    queryBuilder
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('match.id', 'ASC')
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

  async findOne(id: string) {
    const match = await this.matches.findOneBy({ id });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  async getGameState(actorId: string, id: string) {
    const match = await this.findOne(id);
    this.assertMatchPlayer(match, actorId);
    const chess = this.chessFor(match.pgn);
    const playerColor =
      match.whitePlayerId === actorId ? 'w' : 'b';

    return {
      match,
      fen: chess.fen(),
      turn: chess.turn(),
      playerColor,
      legalMoves:
        chess.turn() === playerColor && match.status !== MatchStatus.COMPLETED
          ? chess.moves({ verbose: true }).map((move) => ({
              from: move.from,
              to: move.to,
              promotion: move.promotion,
            }))
          : [],
    };
  }

  async playMove(actorId: string, id: string, dto: PlayMoveDto) {
    const updated = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Match);
      const match = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!match) {
        throw new NotFoundException('Match not found');
      }
      this.assertMatchPlayer(match, actorId);
      if (
        match.status !== MatchStatus.SCHEDULED &&
        match.status !== MatchStatus.IN_PROGRESS
      ) {
        throw new BadRequestException('This match is not in progress');
      }

      const chess = this.chessFor(match.pgn);
      const playerColor =
        match.whitePlayerId === actorId ? 'w' : 'b';
      if (chess.turn() !== playerColor) {
        throw new BadRequestException('It is not your turn');
      }

      try {
        chess.move({
          from: dto.from,
          to: dto.to,
          ...(dto.promotion ? { promotion: dto.promotion } : {}),
        });
      } catch {
        throw new BadRequestException('Illegal chess move');
      }

      match.pgn = chess.pgn();
      match.status = chess.isGameOver()
        ? MatchStatus.COMPLETED
        : MatchStatus.IN_PROGRESS;
      match.completedAt = chess.isGameOver() ? new Date() : null;
      match.result = chess.isGameOver()
        ? chess.isDraw()
          ? MatchResult.DRAW
          : chess.turn() === 'w'
            ? MatchResult.BLACK_WIN
            : MatchResult.WHITE_WIN
        : null;

      const saved = await repository.save(match);
      if (saved.status === MatchStatus.COMPLETED) {
        await this.recalculateRatings(manager);
      }
      return saved;
    });

    if (updated.tournamentId) {
      await this.tournamentPairing.afterMatchUpdate(updated.tournamentId);
    }
    return updated;
  }

  async update(actorId: string, id: string, dto: UpdateMatchDto) {
    await this.assertManager(actorId);
    const current = await this.findOne(id);
    const tournament = current.tournamentId
      ? await this.tournaments.findOneBy({ id: current.tournamentId })
      : null;
    if (
      current.tournamentId &&
      (dto.whitePlayerId !== undefined ||
        dto.blackPlayerId !== undefined ||
        tournament?.status === TournamentStatus.COMPLETED ||
        (tournament &&
          current.roundNumber !== null &&
          current.roundNumber < tournament.currentRound) ||
        dto.status === MatchStatus.CANCELLED)
    ) {
      throw new BadRequestException(
        'Tournament pairings cannot be changed or cancelled',
      );
    }
    const whitePlayerId = dto.whitePlayerId ?? current.whitePlayerId;
    const blackPlayerId = dto.blackPlayerId ?? current.blackPlayerId;
    const status = dto.status ?? current.status;
    const result =
      dto.result === undefined
        ? dto.status !== undefined && dto.status !== MatchStatus.COMPLETED
          ? null
          : current.result
        : dto.result;

    this.validateMatch(
      whitePlayerId,
      blackPlayerId,
      status,
      result ?? undefined,
    );
    await this.assertPlayersExist(whitePlayerId, blackPlayerId);

    const saved = await this.dataSource.transaction(async (manager) => {
      Object.assign(current, dto, {
        whitePlayerId,
        blackPlayerId,
        status,
        result,
        tournamentId: current.tournamentId,
        pgn: dto.pgn === undefined ? current.pgn : dto.pgn,
        completedAt:
          status === MatchStatus.COMPLETED
            ? current.status === MatchStatus.COMPLETED
              ? current.completedAt ?? new Date()
              : new Date()
            : null,
      });
      const saved = await manager.getRepository(Match).save(current);
      await this.recalculateRatings(manager);
      return saved;
    });
    if (saved.tournamentId) {
      await this.tournamentPairing.afterMatchUpdate(saved.tournamentId);
    }
    return saved;
  }

  async remove(actorId: string, id: string) {
    await this.assertManager(actorId);
    const match = await this.findOne(id);
    if (match.tournamentId) {
      throw new BadRequestException(
        'Tournament matches cannot be manually deleted',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Match).remove(match);
      await this.recalculateRatings(manager);
    });
    return { deleted: true, id };
  }

  private assertMatchPlayer(match: Match, playerId: string) {
    if (
      match.whitePlayerId !== playerId &&
      match.blackPlayerId !== playerId
    ) {
      throw new ForbiddenException('Only a player in this match can view it');
    }
  }

  private chessFor(pgn: string | null) {
    const chess = new Chess();
    if (pgn) {
      try {
        chess.loadPgn(pgn);
      } catch {
        throw new BadRequestException('Stored game notation is invalid');
      }
    }
    return chess;
  }

  private validateMatch(
    whitePlayerId: string,
    blackPlayerId: string,
    status?: MatchStatus,
    result?: MatchResult,
  ) {
    if (whitePlayerId === blackPlayerId) {
      throw new BadRequestException('A player cannot play against themselves');
    }

    if (status === MatchStatus.COMPLETED && !result) {
      throw new BadRequestException('A completed match must have a result');
    }

    if (status !== MatchStatus.COMPLETED && result) {
      throw new BadRequestException(
        'A result can only be set for a completed match',
      );
    }
  }

  private async assertPlayersExist(...playerIds: string[]) {
    const uniqueIds = [...new Set(playerIds)];
    const found = await this.users.countBy(uniqueIds.map((id) => ({ id })));
    if (found !== uniqueIds.length) {
      throw new NotFoundException('One or more players were not found');
    }
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
        'Only coaches and admins can manage matches',
      );
    }
  }

  private async recalculateRatings(manager: EntityManager) {
    const users = await manager.getRepository(User).find({
      select: { id: true },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const ratings = new Map<string, number>(
      users.map((user): [string, number] => [user.id, this.initialRating]),
    );
    const completedMatches = await manager.getRepository(Match).find({
      where: { status: MatchStatus.COMPLETED },
      order: { completedAt: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });

    for (const match of completedMatches) {
      const whiteRating = ratings.get(match.whitePlayerId);
      const blackRating = ratings.get(match.blackPlayerId);
      if (
        whiteRating === undefined ||
        blackRating === undefined ||
        !match.result
      ) {
        continue;
      }

      const expectedWhite =
        1 / (1 + 10 ** ((blackRating - whiteRating) / 400));
      const whiteScore =
        match.result === MatchResult.WHITE_WIN
          ? 1
          : match.result === MatchResult.DRAW
            ? 0.5
            : 0;
      const whiteNext = Math.round(
        whiteRating + this.kFactor * (whiteScore - expectedWhite),
      );
      const blackNext = Math.round(
        blackRating + this.kFactor * (1 - whiteScore - (1 - expectedWhite)),
      );
      ratings.set(match.whitePlayerId, whiteNext);
      ratings.set(match.blackPlayerId, blackNext);
    }

    for (const [id, rating] of ratings) {
      await manager.getRepository(User).update(id, { rating });
    }
  }
}
