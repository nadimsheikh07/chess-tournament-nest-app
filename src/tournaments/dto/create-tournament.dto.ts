import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: '5+0',
    description: 'Minutes per player plus increment in seconds; defaults to 5+0',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,2}\+[0-9]{1,3}$/, {
    message: 'timeControl must use minutes+increment format, such as 5+0',
  })
  timeControl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(2)
  maxParticipants: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
