import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { TournamentsModule } from './tournaments/tournaments.module.js';
import { MatchmakingModule } from './matchmaking/matchmaking.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { GamesModule } from './games/games.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'chess-tournament-nest-app',
    }),
    AuthModule,
    UsersModule,
    TournamentsModule,
    MatchmakingModule,
    MatchesModule,
    LeaderboardModule,
    GamesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
