import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MatchResult } from '../entities/match-result.enum';
import { MatchStatus } from '../entities/match-status.enum';

export class FindMatchesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({
    description:
      'Search by match ID, player IDs, tournament ID, status, or result',
    example: 'completed',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by match status',
    enum: MatchStatus,
  })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({
    description: 'Filter by match result',
    enum: MatchResult,
  })
  @IsOptional()
  @IsEnum(MatchResult)
  result?: MatchResult;

  @ApiPropertyOptional({
    description: 'Field used to sort matches',
    enum: [
      'createdAt',
      'updatedAt',
      'completedAt',
      'status',
      'result',
      'whitePlayerId',
      'blackPlayerId',
    ],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'completedAt',
    'status',
    'result',
    'whitePlayerId',
    'blackPlayerId',
  ])
  sortBy = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder = 'DESC';

  @ApiPropertyOptional({
    description: 'Filter matches by tournament ID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;
}
