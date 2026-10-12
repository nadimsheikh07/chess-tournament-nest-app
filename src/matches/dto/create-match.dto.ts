import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchResult } from '../entities/match-result.enum';
import { MatchStatus } from '../entities/match-status.enum';

export class CreateMatchDto {
  @ApiProperty({ format: 'uuid', description: 'White player user ID' })
  @IsUUID()
  whitePlayerId: string;

  @ApiProperty({ format: 'uuid', description: 'Black player user ID' })
  @IsUUID()
  blackPlayerId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional tournament ID',
  })
  @IsOptional()
  @IsUUID()
  tournamentId?: string | null;

  @ApiPropertyOptional({
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({
    enum: MatchResult,
    nullable: true,
    description: 'Required when status is completed',
  })
  @IsOptional()
  @IsEnum(MatchResult)
  result?: MatchResult | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100000,
    description: 'PGN notation for the game',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  pgn?: string | null;
}
