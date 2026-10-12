import { Module } from '@nestjs/common';
import { GamesService } from './games.service.js';
import { GamesGateway } from './games/games.gateway.js';

@Module({
  providers: [GamesService, GamesGateway]
})
export class GamesModule {}
