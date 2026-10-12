import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Matchmaking } from './entities/matchmaking.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MatchmakingGateway } from './matchmaking.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Matchmaking, Match, User]), AuthModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingGateway],
  exports: [MatchmakingService, MatchmakingGateway],
})
export class MatchmakingModule {}
