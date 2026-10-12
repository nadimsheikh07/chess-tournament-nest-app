import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { Match } from '../matches/entities/match.entity';
import { MatchResult } from '../matches/entities/match-result.enum';
import {
  ParticipantStatus,
  TournamentParticipant,
} from './entities/tournament-participant.entity';
import { Tournament, TournamentStatus } from './entities/tournament.entity';
import { TournamentPairingService } from './tournament-pairing.service';

describe('TournamentPairingService standings', () => {
  let service: TournamentPairingService;
  let tournament: Tournament;
  let participants: TournamentParticipant[];
  let participantRepository: {
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let matchRepository: {
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tournament = {
      id: 'tournament',
      status: TournamentStatus.ONGOING,
      currentRound: 1,
    } as Tournament;
    participants = [
      {
        userId: 'white',
        points: 0,
        byeCount: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        status: ParticipantStatus.REGISTERED,
      },
      {
        userId: 'black',
        points: 0,
        byeCount: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        status: ParticipantStatus.REGISTERED,
      },
    ] as TournamentParticipant[];

    const tournamentRepository = {
      findOne: vi.fn().mockResolvedValue(tournament),
      save: vi.fn(async (value: Tournament) => value),
    };
    participantRepository = {
      find: vi.fn().mockResolvedValue(participants),
      save: vi.fn(async (value: TournamentParticipant[]) => value),
      update: vi.fn(),
    };
    matchRepository = {
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((value: Partial<Match>) => value),
      save: vi.fn(async (value: Match[]) => value),
    };
    const manager = {
      getRepository: vi.fn(
        (
          entity:
            typeof Tournament | typeof TournamentParticipant | typeof Match,
        ) => {
          if (entity === Tournament) return tournamentRepository;
          if (entity === TournamentParticipant) return participantRepository;
          return matchRepository;
        },
      ),
    };
    const dataSource = {
      transaction: vi.fn(
        (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
      ),
    };

    service = new TournamentPairingService(dataSource as unknown as DataSource);
  });

  it('awards one point for a win and zero for a loss', async () => {
    matchRepository.find.mockResolvedValue([
      {
        whitePlayerId: 'white',
        blackPlayerId: 'black',
        result: MatchResult.WHITE_WIN,
      },
    ]);

    await service.afterMatchUpdate('tournament');

    expect(participantRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'white', points: 1, wins: 1 }),
      expect.objectContaining({ userId: 'black', points: 0, losses: 1 }),
    ]);
    expect(tournament.status).toBe(TournamentStatus.COMPLETED);
  });

  it('awards half a point to each player for a draw', async () => {
    matchRepository.find.mockResolvedValue([
      {
        whitePlayerId: 'white',
        blackPlayerId: 'black',
        result: MatchResult.DRAW,
      },
    ]);

    await service.afterMatchUpdate('tournament');

    expect(participantRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'white', points: 0.5, draws: 1 }),
      expect.objectContaining({ userId: 'black', points: 0.5, draws: 1 }),
    ]);
    expect(tournament.status).toBe(TournamentStatus.COMPLETED);
  });

  it('schedules a complete one-meeting round robin with tournament clocks', async () => {
    const ids = ['a', 'b', 'c', 'd'];
    participants = ids.map((userId, index) => ({
      id: `${userId}-participant`,
      userId,
      points: 0,
      byeCount: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      joinedAt: new Date(`2026-10-${12 + index}T00:00:00.000Z`),
      status: ParticipantStatus.REGISTERED,
    })) as TournamentParticipant[];
    participantRepository.find.mockImplementation(async () => participants);
    tournament.status = TournamentStatus.OPEN;
    tournament.currentRound = 0;
    tournament.timeControl = '5+3';

    await service.start('tournament');
    const allPairings: Match[] = [];
    allPairings.push(...matchRepository.save.mock.calls[0][0]);

    for (let round = 1; round < 3; round++) {
      await service.afterMatchUpdate('tournament');
      allPairings.push(
        ...matchRepository.save.mock.calls[round][0],
      );
    }
    await service.afterMatchUpdate('tournament');

    const pairs = allPairings.map((match) =>
      [match.whitePlayerId, match.blackPlayerId].sort().join(':'),
    );
    expect(pairs).toHaveLength(6);
    expect(new Set(pairs).size).toBe(6);
    expect(allPairings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          whiteTimeMs: 300000,
          blackTimeMs: 300000,
          incrementMs: 3000,
        }),
      ]),
    );
    expect(tournament.status).toBe(TournamentStatus.COMPLETED);
  });

  it('rotates one bye per participant in an odd-sized round robin', async () => {
    participants = ['a', 'b', 'c'].map((userId, index) => ({
      id: `${userId}-participant`,
      userId,
      points: 0,
      byeCount: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      joinedAt: new Date(`2026-10-${12 + index}T00:00:00.000Z`),
      status: ParticipantStatus.REGISTERED,
    })) as TournamentParticipant[];
    participantRepository.find.mockImplementation(async () => participants);
    tournament.status = TournamentStatus.OPEN;
    tournament.currentRound = 0;
    tournament.timeControl = '5+0';

    await service.start('tournament');
    const allPairings: Match[] = [...matchRepository.save.mock.calls[0][0]];
    await service.afterMatchUpdate('tournament');
    allPairings.push(...matchRepository.save.mock.calls[1][0]);
    await service.afterMatchUpdate('tournament');
    allPairings.push(...matchRepository.save.mock.calls[2][0]);
    await service.afterMatchUpdate('tournament');

    const pairs = allPairings.map((match) =>
      [match.whitePlayerId, match.blackPlayerId].sort().join(':'),
    );
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs).size).toBe(3);
    expect(participants.map(({ byeCount }) => byeCount)).toEqual([1, 1, 1]);
    expect(tournament.status).toBe(TournamentStatus.COMPLETED);
  });
});
