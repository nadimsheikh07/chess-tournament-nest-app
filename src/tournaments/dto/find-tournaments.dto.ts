import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TournamentStatus } from '../entities/tournament.entity';

export class FindTournamentsDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of tournaments per page (maximum 100)',
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
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Search tournament name or description',
    example: 'chess',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Field used to sort tournaments',
    enum: ['name', 'startDate', 'createdAt', 'maxParticipants'],
    default: 'startDate',
  })
  @IsOptional()
  @IsIn(['name', 'startDate', 'createdAt', 'maxParticipants'])
  sortBy: string = 'startDate';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder: string = 'ASC';

  @ApiPropertyOptional({
    description: 'Filter by tournament status',
    enum: TournamentStatus,
    example: TournamentStatus.UPCOMING,
  })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}
