import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchResult } from './match-result.enum';
import { MatchStatus } from './match-status.enum';

export const DEFAULT_MATCH_CLOCK_MS = 10 * 60 * 1000;

@Entity('matches')
@Index(['whitePlayerId', 'createdAt'])
@Index(['blackPlayerId', 'createdAt'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  whitePlayerId: string;

  @Column({ type: 'uuid' })
  blackPlayerId: string;

  @Column({ type: 'uuid', nullable: true })
  tournamentId: string | null;

  @Column({ type: 'int', nullable: true })
  roundNumber: number | null;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @Column({ type: 'enum', enum: MatchResult, nullable: true })
  result: MatchResult | null;

  @Column({ type: 'text', nullable: true })
  pgn: string | null;

  @Column({ type: 'int', default: DEFAULT_MATCH_CLOCK_MS })
  whiteTimeMs: number;

  @Column({ type: 'int', default: DEFAULT_MATCH_CLOCK_MS })
  blackTimeMs: number;

  @Column({ type: 'int', default: 0 })
  incrementMs: number;

  @Column({ type: 'uuid', nullable: true })
  drawOfferedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  clockStartedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  endReason:
    | 'checkmate'
    | 'stalemate'
    | 'draw'
    | 'resignation'
    | 'timeout'
    | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
