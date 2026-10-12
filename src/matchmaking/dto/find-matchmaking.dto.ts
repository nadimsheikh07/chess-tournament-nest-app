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
import { MatchmakingStatus } from '../entities/matchmaking-status.enum';

export class FindMatchmakingDto {
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
    description: 'Search queue ID, user ID, match ID, status, or rating',
    example: 'waiting',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Field used to sort queue entries',
    enum: ['queuedAt', 'updatedAt', 'rating', 'status', 'userId'],
    default: 'queuedAt',
  })
  @IsOptional()
  @IsIn(['queuedAt', 'updatedAt', 'rating', 'status', 'userId'])
  sortBy = 'queuedAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder = 'ASC';

  @ApiPropertyOptional({ description: 'Filter by entry status', enum: MatchmakingStatus })
  @IsOptional()
  @IsEnum(MatchmakingStatus)
  status?: MatchmakingStatus;

  @ApiPropertyOptional({ description: 'Filter by user ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
