import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Tournament } from './tournament.entity';

export enum ParticipantStatus {
  REGISTERED = 'registered',
  WAITING = 'waiting',
  ELIMINATED = 'eliminated',
  COMPLETED = 'completed',
}

@Entity('tournament_participants')
@Unique('UQ_tournament_participant', ['tournamentId', 'userId'])
export class TournamentParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.REGISTERED,
  })
  status: ParticipantStatus;

  @Column({ type: 'double precision', default: 0 })
  points: number;

  @Column({ type: 'int', default: 0 })
  byeCount: number;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  draws: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @CreateDateColumn()
  joinedAt: Date;
}
