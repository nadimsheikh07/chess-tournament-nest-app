import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MatchmakingService } from './matchmaking.service';
import { Matchmaking } from './entities/matchmaking.entity';
import { User } from '../users/entities/user.entity';

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: getRepositoryToken(Matchmaking), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
