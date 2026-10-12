import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { TournamentPairingService } from '../tournaments/tournament-pairing.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Match } from './entities/match.entity';
import { MatchResult } from './entities/match-result.enum';
import { MatchStatus } from './entities/match-status.enum';
import { MatchesService } from './matches.service';

const playerWhite = '11111111-1111-4111-8111-111111111111';
const playerBlack = '22222222-2222-4222-8222-222222222222';
const matchId = '33333333-3333-4333-8333-333333333333';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: matchId,
    whitePlayerId: playerWhite,
    blackPlayerId: playerBlack,
    tournamentId: null,
    roundNumber: null,
    status: MatchStatus.IN_PROGRESS,
    result: null,
    pgn: null,
    whiteTimeMs: 600000,
    blackTimeMs: 600000,
    incrementMs: 0,
    drawOfferedBy: null,
    clockStartedAt: null,
    endReason: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MatchesService live games', () => {
  let service: MatchesService;
  let matchRepository: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let userRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
    matchRepository = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (match: Match) => match),
    };
    userRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };
    const manager = {
      getRepository: vi.fn((entity: typeof Match | typeof User) =>
        entity === User ? userRepository : matchRepository,
      ),
    };
    const dataSource = {
      transaction: vi.fn(
        async (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
      ),
    };
    const pairingService = { afterMatchUpdate: vi.fn() };

    service = new MatchesService(
      matchRepository as unknown as Repository<Match>,
      userRepository as unknown as Repository<User>,
      {} as Repository<Tournament>,
      dataSource as unknown as DataSource,
      pairingService as unknown as TournamentPairingService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a scheduled game and returns legal moves, clock, and PGN history', async () => {
    const match = createMatch({
      status: MatchStatus.SCHEDULED,
      clockStartedAt: null,
    });
    matchRepository.findOne.mockResolvedValue(match);

    const state = await service.getGameState(playerWhite, matchId);

    expect(match.status).toBe(MatchStatus.IN_PROGRESS);
    expect(match.clockStartedAt).toEqual(new Date('2026-10-12T12:00:00.000Z'));
    expect(state.whiteTimeMs).toBe(600000);
    expect(state.blackTimeMs).toBe(600000);
    expect(state.pgn).toContain('[Event "?"]');
    expect(state.moves).toEqual([]);
    expect(state.movePositions).toHaveLength(1);
    expect(state.legalMoves).toContainEqual({
      from: 'e2',
      to: 'e4',
      promotion: undefined,
    });
  });

  it('stores the PGN and deducts the active player clock when a move is made', async () => {
    const match = createMatch({
      clockStartedAt: new Date('2026-10-12T11:59:55.000Z'),
    });
    matchRepository.findOne.mockResolvedValue(match);

    const updated = await service.playMove(playerWhite, matchId, {
      from: 'e2',
      to: 'e4',
    });

    expect(updated.pgn).toContain('1. e4 *');
    expect(updated.whiteTimeMs).toBe(595000);
    expect(updated.clockStartedAt).toEqual(
      new Date('2026-10-12T12:00:00.000Z'),
    );
    expect(updated.status).toBe(MatchStatus.IN_PROGRESS);
  });

  it('adds the configured increment after a legal move', async () => {
    const match = createMatch({
      incrementMs: 3000,
      clockStartedAt: new Date('2026-10-12T11:59:55.000Z'),
    });
    matchRepository.findOne.mockResolvedValue(match);

    await service.playMove(playerWhite, matchId, { from: 'e2', to: 'e4' });

    expect(match.whiteTimeMs).toBe(598000);
  });

  it('automatically ends the game as a draw on threefold repetition', async () => {
    const match = createMatch();
    matchRepository.findOne.mockResolvedValue(match);
    const moves = [
      [playerWhite, 'g1', 'f3'],
      [playerBlack, 'g8', 'f6'],
      [playerWhite, 'f3', 'g1'],
      [playerBlack, 'f6', 'g8'],
      [playerWhite, 'g1', 'f3'],
      [playerBlack, 'g8', 'f6'],
      [playerWhite, 'f3', 'g1'],
      [playerBlack, 'f6', 'g8'],
    ] as const;

    for (const [playerId, from, to] of moves) {
      await service.playMove(playerId, matchId, { from, to });
    }

    expect(match.status).toBe(MatchStatus.COMPLETED);
    expect(match.result).toBe(MatchResult.DRAW);
    expect(match.endReason).toBe('draw');
  });

  it('automatically ends the game as a draw after 50 moves without a pawn move or capture', async () => {
    const match = createMatch({
      pgn: [
        '[SetUp "1"]',
        '[FEN "7k/8/8/8/8/8/8/K5R1 w - - 99 50"]',
        '',
        '*',
      ].join('\n'),
    });
    matchRepository.findOne.mockResolvedValue(match);

    await service.playMove(playerWhite, matchId, {
      from: 'g1',
      to: 'g2',
    });

    expect(match.status).toBe(MatchStatus.COMPLETED);
    expect(match.result).toBe(MatchResult.DRAW);
    expect(match.endReason).toBe('draw');
  });

  it('allows coaches to spectate without exposing legal moves', async () => {
    userRepository.findOne.mockResolvedValue({
      id: playerWhite,
      role: UserRole.COACH,
    });
    matchRepository.findOne.mockResolvedValue(createMatch());

    const state = await service.getGameState(playerWhite, matchId);

    expect(state.playerColor).toBeNull();
    expect(state.legalMoves).toEqual([]);
  });

  it('completes a game when the opponent accepts a pending draw offer', async () => {
    const match = createMatch({ drawOfferedBy: playerWhite });
    matchRepository.findOne.mockResolvedValue(match);

    const updated = await service.respondToDraw(playerBlack, matchId, true);

    expect(updated.status).toBe(MatchStatus.COMPLETED);
    expect(updated.result).toBe(MatchResult.DRAW);
    expect(updated.drawOfferedBy).toBeNull();
  });

  it('rejects a move when it is not the submitting player’s turn', async () => {
    matchRepository.findOne.mockResolvedValue(createMatch());

    await expect(
      service.playMove(playerBlack, matchId, { from: 'e7', to: 'e5' }),
    ).rejects.toThrow('It is not your turn');
  });

  it('rejects a move that is not legal in the current position', async () => {
    matchRepository.findOne.mockResolvedValue(createMatch());

    await expect(
      service.playMove(playerWhite, matchId, { from: 'e2', to: 'e5' }),
    ).rejects.toThrow('Illegal chess move');
  });

  it('records a timeout as a loss for the player whose clock expired', async () => {
    const match = createMatch({
      clockStartedAt: new Date('2026-10-12T11:49:59.000Z'),
    });
    matchRepository.findOne.mockResolvedValue(match);

    const state = await service.getGameState(playerWhite, matchId);

    expect(state.match.status).toBe(MatchStatus.COMPLETED);
    expect(state.match.result).toBe(MatchResult.BLACK_WIN);
    expect(state.match.endReason).toBe('timeout');
    expect(state.match.whiteTimeMs).toBe(0);
    expect(state.clockExpired).toBe(true);
  });
});
