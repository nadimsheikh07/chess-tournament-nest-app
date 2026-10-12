import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Match } from '../matches/entities/match.entity';
import { MatchResult } from '../matches/entities/match-result.enum';
import { MatchStatus } from '../matches/entities/match-status.enum';
import {
  ParticipantStatus,
  TournamentParticipant,
} from './entities/tournament-participant.entity';
import { Tournament, TournamentStatus } from './entities/tournament.entity';

@Injectable()
export class TournamentPairingService {
  constructor(private readonly dataSource: DataSource) {}

  async start(tournamentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tournamentRepository = manager.getRepository(Tournament);
      const tournament = await tournamentRepository.findOne({
        where: { id: tournamentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tournament) {
        throw new NotFoundException('Tournament not found');
      }
      if (tournament.status !== TournamentStatus.OPEN) {
        throw new BadRequestException('Tournament is not open for starting');
      }

      const participants = await this.registeredParticipants(
        manager,
        tournamentId,
      );
      if (participants.length < 2) {
        throw new BadRequestException(
          'At least two registered participants are required',
        );
      }

      tournament.status = TournamentStatus.ONGOING;
      tournament.currentRound = 1;
      await tournamentRepository.save(tournament);
      const matches = await this.createRound(manager, tournament, participants);

      return { tournament, round: tournament.currentRound, matches };
    });
  }

  async afterMatchUpdate(tournamentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tournamentRepository = manager.getRepository(Tournament);
      const tournament = await tournamentRepository.findOne({
        where: { id: tournamentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !tournament ||
        tournament.status !== TournamentStatus.ONGOING ||
        tournament.currentRound < 1
      ) {
        return;
      }

      const participants = await this.registeredParticipants(
        manager,
        tournamentId,
      );
      await this.refreshStandings(manager, tournamentId, participants);

      const unfinishedMatches = await manager.getRepository(Match).count({
        where: {
          tournamentId,
          roundNumber: tournament.currentRound,
          status: MatchStatus.SCHEDULED,
        },
      });
      const inProgressMatches = await manager.getRepository(Match).count({
        where: {
          tournamentId,
          roundNumber: tournament.currentRound,
          status: MatchStatus.IN_PROGRESS,
        },
      });
      if (unfinishedMatches + inProgressMatches > 0) {
        return;
      }

      const totalRounds =
        participants.length % 2 === 0
          ? participants.length - 1
          : participants.length;
      if (tournament.currentRound >= totalRounds) {
        tournament.status = TournamentStatus.COMPLETED;
        await tournamentRepository.save(tournament);
        await manager.getRepository(TournamentParticipant).update(
          { tournamentId, status: ParticipantStatus.REGISTERED },
          { status: ParticipantStatus.COMPLETED },
        );
        return;
      }

      tournament.currentRound += 1;
      await tournamentRepository.save(tournament);
      await this.createRound(manager, tournament, participants);
    });
  }

  private async registeredParticipants(
    manager: EntityManager,
    tournamentId: string,
  ) {
    return manager.getRepository(TournamentParticipant).find({
      where: [
        { tournamentId, status: ParticipantStatus.REGISTERED },
        { tournamentId, status: ParticipantStatus.COMPLETED },
      ],
      order: { joinedAt: 'ASC', id: 'ASC' },
    });
  }

  private async createRound(
    manager: EntityManager,
    tournament: Tournament,
    participants: TournamentParticipant[],
  ) {
    const matchRepository = manager.getRepository(Match);
    const slots: (TournamentParticipant | null)[] = [...participants];
    if (slots.length % 2 === 1) {
      slots.push(null);
    }
    const fixed = slots[0];
    let rotating = slots.slice(1);
    const matches: Match[] = [];
    const createdMatches: Match[] = [];
    const minutes = Number(tournament.timeControl.split('+')[0]);
    const incrementSeconds = Number(tournament.timeControl.split('+')[1]);
    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      !Number.isInteger(incrementSeconds) ||
      incrementSeconds < 0
    ) {
      throw new BadRequestException('Tournament time control is invalid');
    }

    for (let roundIndex = 0; roundIndex < tournament.currentRound; roundIndex++) {
      const roundSlots = [fixed, ...rotating];
      const roundMatches: {
        left: TournamentParticipant | null;
        right: TournamentParticipant | null;
      }[] = [];
      for (let pairIndex = 0; pairIndex < roundSlots.length / 2; pairIndex++) {
        roundMatches.push({
          left: roundSlots[pairIndex],
          right: roundSlots[roundSlots.length - 1 - pairIndex],
        });
      }

      if (roundIndex === tournament.currentRound - 1) {
        for (const [pairIndex, pair] of roundMatches.entries()) {
          if (!pair.left || !pair.right) {
            const bye = pair.left ?? pair.right;
            if (bye) {
              bye.byeCount += 1;
              await manager.getRepository(TournamentParticipant).save(bye);
            }
            continue;
          }
          const white =
            (roundIndex + pairIndex) % 2 === 0 ? pair.left : pair.right;
          const black = white.id === pair.left.id ? pair.right : pair.left;
          matches.push(
            matchRepository.create({
              whitePlayerId: white.userId,
              blackPlayerId: black.userId,
              tournamentId: tournament.id,
              roundNumber: tournament.currentRound,
              status: MatchStatus.SCHEDULED,
              result: null,
              pgn: null,
              whiteTimeMs: minutes * 60_000,
              blackTimeMs: minutes * 60_000,
              incrementMs: incrementSeconds * 1000,
              completedAt: null,
            }),
          );
        }
      }

      const last = rotating[rotating.length - 1];
      rotating = [last, ...rotating.slice(0, -1)];
    }
    createdMatches.push(...(await matchRepository.save(matches)));

    await this.refreshStandings(manager, tournament.id, participants);
    return createdMatches;
  }

  private async refreshStandings(
    manager: EntityManager,
    tournamentId: string,
    participants: TournamentParticipant[],
  ) {
    const completedMatches = await manager.getRepository(Match).find({
      where: { tournamentId, status: MatchStatus.COMPLETED },
    });
    const stats = new Map(
      participants.map((participant) => [
        participant.userId,
        {
          points: participant.byeCount,
          wins: 0,
          draws: 0,
          losses: 0,
        },
      ]),
    );

    for (const match of completedMatches) {
      const white = stats.get(match.whitePlayerId);
      const black = stats.get(match.blackPlayerId);
      if (!white || !black || !match.result) {
        continue;
      }
      if (match.result === MatchResult.DRAW) {
        white.points += 0.5;
        black.points += 0.5;
        white.draws += 1;
        black.draws += 1;
      } else if (match.result === MatchResult.WHITE_WIN) {
        white.points += 1;
        white.wins += 1;
        black.losses += 1;
      } else {
        black.points += 1;
        black.wins += 1;
        white.losses += 1;
      }
    }

    for (const participant of participants) {
      const result = stats.get(participant.userId);
      if (result) {
        Object.assign(participant, result);
      }
    }
    await manager.getRepository(TournamentParticipant).save(participants);
  }
}
