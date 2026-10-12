import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { Tournament, TournamentStatus } from './entities/tournament.entity';
import {
  ParticipantStatus,
  TournamentParticipant,
} from './entities/tournament-participant.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { FindTournamentsDto } from './dto/find-tournaments.dto';
import { TournamentPairingService } from './tournament-pairing.service';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,

    @InjectRepository(TournamentParticipant)
    private readonly participantRepo: Repository<TournamentParticipant>,

    @InjectRepository(User)
    private readonly users: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly pairingService: TournamentPairingService,
  ) {}

  async create(coachId: string, dto: CreateTournamentDto) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (
      Number.isNaN(startDate.getTime()) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      throw new BadRequestException('Invalid tournament date');
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const tournament = this.tournamentRepo.create({
      ...dto,
      coachId,
      startDate,
      endDate,
      status: TournamentStatus.DRAFT,
    });

    return this.tournamentRepo.save(tournament);
  }

  async findAll(query: FindTournamentsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'startDate',
      sortOrder = 'ASC',
      status,
    } = query;

    const allowedSortFields = {
      name: 'tournament.name',
      startDate: 'tournament.startDate',
      createdAt: 'tournament.createdAt',
      maxParticipants: 'tournament.maxParticipants',
    } as const;

    const orderColumn =
      allowedSortFields[sortBy as keyof typeof allowedSortFields] ??
      allowedSortFields.startDate;

    const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const queryBuilder = this.tournamentRepo.createQueryBuilder('tournament');

    if (search?.trim()) {
      queryBuilder.andWhere(
        `(
        tournament.name ILIKE :search
        OR tournament.description ILIKE :search
      )`,
        { search: `%${search.trim()}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('tournament.status = :status', {
        status,
      });
    }

    queryBuilder
      .orderBy(orderColumn, orderDirection)
      .addOrderBy('tournament.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const tournament = await this.tournamentRepo.findOne({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  async update(id: string, coachId: string, dto: UpdateTournamentDto) {
    const tournament = await this.findOne(id);

    await this.assertManager(tournament.coachId, coachId);

    if (
      tournament.status === TournamentStatus.ONGOING ||
      tournament.status === TournamentStatus.COMPLETED
    ) {
      throw new BadRequestException('This tournament can no longer be edited');
    }

    if (
      dto.status !== undefined &&
      dto.status !== TournamentStatus.OPEN &&
      dto.status !== TournamentStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Use the start action to begin a tournament',
      );
    }

    if (
      dto.status === TournamentStatus.DRAFT &&
      tournament.status === TournamentStatus.OPEN
    ) {
      const participantCount = await this.participantRepo.count({
        where: { tournamentId: id },
      });
      if (participantCount > 0) {
        throw new BadRequestException(
          'A tournament with participants cannot be returned to draft',
        );
      }
    }

    if (dto.maxParticipants !== undefined) {
      const registeredCount = await this.participantRepo.count({
        where: { tournamentId: id, status: ParticipantStatus.REGISTERED },
      });
      if (dto.maxParticipants < registeredCount) {
        throw new BadRequestException(
          'Maximum participants cannot be lower than the registered count',
        );
      }
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : tournament.startDate;

    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : tournament.endDate;

    if (
      Number.isNaN(startDate.getTime()) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      throw new BadRequestException('Invalid tournament date');
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    Object.assign(tournament, dto, { startDate, endDate });

    return this.tournamentRepo.save(tournament);
  }

  async remove(id: string, coachId: string) {
    const tournament = await this.findOne(id);
    await this.assertManager(tournament.coachId, coachId);
    if (
      tournament.status === TournamentStatus.ONGOING ||
      tournament.status === TournamentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'An ongoing or completed tournament cannot be deleted',
      );
    }
    await this.tournamentRepo.remove(tournament);
    return { deleted: true, id };
  }

  async join(tournamentId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      // Lock the tournament row to prevent concurrent registrations
      // from exceeding its participant capacity.
      const tournament = await manager.getRepository(Tournament).findOne({
        where: { id: tournamentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tournament) {
        throw new NotFoundException('Tournament not found');
      }

      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.role !== UserRole.PLAYER) {
        throw new ForbiddenException('Only students can join tournaments');
      }

      if (tournament.status !== TournamentStatus.OPEN) {
        throw new BadRequestException('Tournament registration is not open');
      }

      const existing = await manager
        .getRepository(TournamentParticipant)
        .findOne({
          where: { tournamentId, userId },
        });

      if (existing) {
        throw new BadRequestException(
          'You have already joined this tournament',
        );
      }

      const participantRepository = manager.getRepository(
        TournamentParticipant,
      );

      const registeredCount = await participantRepository.count({
        where: {
          tournamentId,
          status: ParticipantStatus.REGISTERED,
        },
      });

      const status =
        registeredCount < tournament.maxParticipants
          ? ParticipantStatus.REGISTERED
          : ParticipantStatus.WAITING;

      const participant = participantRepository.create({
        tournamentId,
        userId,
        status,
      });

      return participantRepository.save(participant);
    });
  }

  async getParticipants(tournamentId: string) {
    await this.findOne(tournamentId);

    return this.participantRepo.find({
      where: { tournamentId },
      order: {
        points: 'DESC',
        wins: 'DESC',
        joinedAt: 'ASC',
      },
    });
  }

  async getLeaderboard(tournamentId: string) {
    await this.findOne(tournamentId);

    const participants = await this.participantRepo.find({
      where: {
        tournamentId,
        status: In([ParticipantStatus.REGISTERED, ParticipantStatus.COMPLETED]),
      },
      order: {
        points: 'DESC',
        wins: 'DESC',
        joinedAt: 'ASC',
        id: 'ASC',
      },
    });
    return participants.map((participant, index) => ({
      ...participant,
      rank: index + 1,
    }));
  }

  async start(tournamentId: string, coachId: string) {
    const tournament = await this.findOne(tournamentId);
    await this.assertManager(tournament.coachId, coachId);
    return this.pairingService.start(tournamentId);
  }

  async getMatches(tournamentId: string) {
    await this.findOne(tournamentId);
    return this.dataSource.getRepository(Match).find({
      where: { tournamentId },
      order: { roundNumber: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  async getWinner(tournamentId: string) {
    const tournament = await this.findOne(tournamentId);
    if (tournament.status !== TournamentStatus.COMPLETED) {
      throw new BadRequestException(
        'The tournament winner is available after completion',
      );
    }
    const [winner] = await this.getLeaderboard(tournamentId);
    if (!winner) {
      throw new NotFoundException('Tournament winner not found');
    }
    return winner;
  }

  async getMySchedule(userId: string) {
    const registrations = await this.participantRepo.find({
      where: { userId },
      relations: { tournament: true },
      order: { joinedAt: 'DESC' },
    });

    return registrations.map((registration) => ({
      tournamentId: registration.tournamentId,
      tournamentName: registration.tournament.name,
      startDate: registration.tournament.startDate,
      endDate: registration.tournament.endDate,
      tournamentStatus: registration.tournament.status,
      participantStatus: registration.status,
      points: registration.points,
    }));
  }

  private async assertManager(ownerId: string, actorId: string) {
    if (ownerId === actorId) {
      return;
    }
    const actor = await this.users.findOne({
      where: { id: actorId },
      select: { id: true, role: true },
    });
    if (!actor) {
      throw new NotFoundException('User not found');
    }
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You cannot manage this tournament');
    }
  }
}
