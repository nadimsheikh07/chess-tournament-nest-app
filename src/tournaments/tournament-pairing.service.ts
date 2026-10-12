import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Match } from '../matches/entities/match.entity';
import { MatchResult } from '../matches/entities/match-result.enum';
import { MatchStatus } from '../matches/entities/match-status.enum';
import { User } from '../users/entities/user.entity';
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

      const totalRounds = Math.ceil(Math.log2(participants.length));
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
      order: { points: 'DESC', wins: 'DESC', joinedAt: 'ASC', id: 'ASC' },
    });
  }

  private async createRound(
    manager: EntityManager,
    tournament: Tournament,
    participants: TournamentParticipant[],
  ) {
    const matchRepository = manager.getRepository(Match);
    const priorMatches = await matchRepository.find({
      where: { tournamentId: tournament.id },
      select: { whitePlayerId: true, blackPlayerId: true },
    });
    const faced = new Set(
      priorMatches.map((match) =>
        [match.whitePlayerId, match.blackPlayerId].sort().join(':'),
      ),
    );
    const colorBalance = new Map<string, number>();
    for (const match of priorMatches) {
      colorBalance.set(
        match.whitePlayerId,
        (colorBalance.get(match.whitePlayerId) ?? 0) + 1,
      );
      colorBalance.set(
        match.blackPlayerId,
        (colorBalance.get(match.blackPlayerId) ?? 0) - 1,
      );
    }
    const users = await manager.getRepository(User).find({
      select: { id: true, rating: true },
    });
    const ratings = new Map(users.map((user) => [user.id, user.rating]));
    let remaining = [...participants];
    const createdMatches: Match[] = [];

    if (remaining.length % 2 === 1) {
      const byeCandidate = [...remaining]
        .reverse()
        .find((participant) => participant.byeCount === 0) ??
        remaining[remaining.length - 1];
      byeCandidate.byeCount += 1;
      await manager.getRepository(TournamentParticipant).save(byeCandidate);
      remaining = remaining.filter(({ id }) => id !== byeCandidate.id);
    }

    while (remaining.length >= 2) {
      const white = remaining.shift()!;
      const candidates = remaining
        .map((candidate, index) => ({
          candidate,
          index,
          rematch: faced.has(
            [white.userId, candidate.userId].sort().join(':'),
          ),
          pointsDifference: Math.abs(white.points - candidate.points),
          ratingDifference: Math.abs(
            (ratings.get(white.userId) ?? 1200) -
              (ratings.get(candidate.userId) ?? 1200),
          ),
        }))
        .sort(
          (left, right) =>
            Number(left.rematch) - Number(right.rematch) ||
            left.pointsDifference - right.pointsDifference ||
            left.ratingDifference - right.ratingDifference ||
            left.index - right.index,
        );
      const [opponent] = candidates;
      remaining.splice(opponent.index, 1);
      const whitePlayer =
        (colorBalance.get(white.userId) ?? 0) <=
        (colorBalance.get(opponent.candidate.userId) ?? 0)
          ? white
          : opponent.candidate;
      const blackPlayer =
        whitePlayer.id === white.id ? opponent.candidate : white;
      createdMatches.push(
        await matchRepository.save(
          matchRepository.create({
            whitePlayerId: whitePlayer.userId,
            blackPlayerId: blackPlayer.userId,
            tournamentId: tournament.id,
            roundNumber: tournament.currentRound,
            status: MatchStatus.SCHEDULED,
            result: null,
            pgn: null,
            completedAt: null,
          }),
        ),
      );
      colorBalance.set(
        whitePlayer.userId,
        (colorBalance.get(whitePlayer.userId) ?? 0) + 1,
      );
      colorBalance.set(
        blackPlayer.userId,
        (colorBalance.get(blackPlayer.userId) ?? 0) - 1,
      );
    }

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
