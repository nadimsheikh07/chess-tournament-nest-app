import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

const squares = /^[a-h][1-8]$/;

export class PlayMoveDto {
  @ApiProperty({ example: 'e2' })
  @Matches(squares)
  from: string;

  @ApiProperty({ example: 'e4' })
  @Matches(squares)
  to: string;

  @ApiProperty({ enum: ['q', 'r', 'b', 'n'], required: false })
  @IsOptional()
  @IsIn(['q', 'r', 'b', 'n'])
  promotion?: 'q' | 'r' | 'b' | 'n';
}
