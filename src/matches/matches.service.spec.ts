import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
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
  let userRepository: { find: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
    matchRepository = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (match: Match) => match),
    };
    userRepository = { find: vi.fn().mockResolvedValue([]) };
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
