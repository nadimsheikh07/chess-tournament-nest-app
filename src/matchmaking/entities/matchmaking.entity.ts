import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchmakingStatus } from './matchmaking-status.enum';

@Entity('matchmaking_queue')
@Index(['userId', 'status'])
@Index(['status', 'queuedAt'])
export class Matchmaking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({
    type: 'enum',
    enum: MatchmakingStatus,
    default: MatchmakingStatus.WAITING,
  })
  status: MatchmakingStatus;

  @Column({ type: 'uuid', nullable: true })
  matchId: string | null;

  @CreateDateColumn()
  queuedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
