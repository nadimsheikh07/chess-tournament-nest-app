import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Matchmaking } from './entities/matchmaking.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Matchmaking, Match, User])],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
