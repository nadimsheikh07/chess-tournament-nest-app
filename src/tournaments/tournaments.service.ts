import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Tournament, TournamentStatus } from './entities/tournament.entity';
import {
  ParticipantStatus,
  TournamentParticipant,
} from './entities/tournament-participant.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { FindTournamentsDto } from './dto/find-tournaments.dto';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,

    @InjectRepository(TournamentParticipant)
    private readonly participantRepo: Repository<TournamentParticipant>,

    private readonly dataSource: DataSource,
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
      status: TournamentStatus.UPCOMING,
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

    if (tournament.coachId !== coachId) {
      throw new ForbiddenException('You cannot update this tournament');
    }

    if (
      tournament.status === TournamentStatus.ACTIVE ||
      tournament.status === TournamentStatus.COMPLETED ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw new BadRequestException('This tournament can no longer be edited');
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

      if (tournament.status !== TournamentStatus.UPCOMING) {
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

    return this.participantRepo.find({
      where: {
        tournamentId,
        status: ParticipantStatus.COMPLETED,
      },
      order: {
        points: 'DESC',
        wins: 'DESC',
        joinedAt: 'ASC',
      },
    });
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
}
