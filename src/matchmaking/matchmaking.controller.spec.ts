import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';

describe('MatchmakingController', () => {
  let controller: MatchmakingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchmakingController],
      providers: [
        { provide: MatchmakingService, useValue: {} },
        { provide: MatchmakingGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get<MatchmakingController>(MatchmakingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
