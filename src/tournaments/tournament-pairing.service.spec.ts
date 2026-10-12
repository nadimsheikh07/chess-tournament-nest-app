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
});
