import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entities/tournament.entity';
import { TournamentParticipant } from './entities/tournament-participant.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { TournamentPairingService } from './tournament-pairing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, TournamentParticipant, Match, User]),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentPairingService],
  exports: [TournamentPairingService],
})
export class TournamentsModule {}
