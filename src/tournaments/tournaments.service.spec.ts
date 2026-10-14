import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import {
  ParticipantStatus,
  TournamentParticipant,
} from './entities/tournament-participant.entity';
import { Tournament, TournamentStatus } from './entities/tournament.entity';
import { TournamentPairingService } from './tournament-pairing.service';
import { TournamentsService } from './tournaments.service';

describe('TournamentsService', () => {
  let service: TournamentsService;
  let tournamentRepository: { findOne: ReturnType<typeof vi.fn> };
  let userRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let participantRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    tournamentRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'tournament',
        status: TournamentStatus.OPEN,
        maxParticipants: 2,
      }),
    };
    userRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({
        id: 'player',
        role: UserRole.PLAYER,
      }),
    };
    participantRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((participant) => participant),
      save: vi.fn(async (participant) => participant),
    };
    const manager = {
      getRepository: vi.fn(
        (
          entity:
            typeof Tournament | typeof User | typeof TournamentParticipant,
        ) => {
          if (entity === Tournament) return tournamentRepository;
          if (entity === User) return userRepository;
          return participantRepository;
        },
      ),
    };
    const dataSource = {
      transaction: vi.fn(
        (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
      ),
    };

    service = new TournamentsService(
      tournamentRepository as unknown as Repository<Tournament>,
      participantRepository as unknown as Repository<TournamentParticipant>,
      userRepository as unknown as Repository<User>,
      dataSource as unknown as DataSource,
      {} as unknown as TournamentPairingService,
    );
  });

  it('registers a player when an open tournament has capacity', async () => {
    await service.join('tournament', 'player');

    expect(participantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament',
        userId: 'player',
        status: ParticipantStatus.REGISTERED,
      }),
    );
  });

  it('waitlists a player when registered capacity is full', async () => {
    participantRepository.count.mockResolvedValue(2);

    await service.join('tournament', 'player');

    expect(participantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ParticipantStatus.WAITING }),
    );
  });

  it('rejects registration when the tournament is not open', async () => {
    tournamentRepository.findOne.mockResolvedValue({
      id: 'tournament',
      status: TournamentStatus.DRAFT,
      maxParticipants: 2,
    });

    await expect(service.join('tournament', 'player')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-player accounts', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'player',
      role: UserRole.COACH,
    });

    await expect(service.join('tournament', 'player')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects duplicate registrations', async () => {
    participantRepository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(service.join('tournament', 'player')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns participant names with tournament participants', async () => {
    participantRepository.find.mockResolvedValue([
      { userId: 'player', status: ParticipantStatus.REGISTERED },
    ]);
    userRepository.find.mockResolvedValue([{ id: 'player', name: 'Alex' }]);

    await expect(service.getParticipants('tournament')).resolves.toEqual([
      expect.objectContaining({ userId: 'player', name: 'Alex' }),
    ]);
  });

  it('returns participant names with leaderboard standings', async () => {
    participantRepository.find.mockResolvedValue([
      { userId: 'player', status: ParticipantStatus.REGISTERED },
    ]);
    userRepository.find.mockResolvedValue([{ id: 'player', name: 'Alex' }]);

    await expect(service.getLeaderboard('tournament')).resolves.toEqual([
      expect.objectContaining({
        userId: 'player',
        name: 'Alex',
        rank: 1,
      }),
    ]);
  });
});
