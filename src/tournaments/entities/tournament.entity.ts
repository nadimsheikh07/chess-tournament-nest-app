import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TournamentParticipant } from './tournament-participant.entity';

export enum TournamentStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 20, default: '5+0' })
  timeControl: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  coachId: string;

  @Column({ type: 'int', default: 16 })
  maxParticipants: number;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({
    type: 'enum',
    enum: TournamentStatus,
    default: TournamentStatus.DRAFT,
  })
  status: TournamentStatus;

  @Column({ type: 'int', default: 0 })
  currentRound: number;

  @OneToMany(
    () => TournamentParticipant,
    (participant) => participant.tournament,
  )
  participants: TournamentParticipant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
