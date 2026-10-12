import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

@Controller('matches')
@UseGuards(JwtAuthGuard)
@ApiTags('Matches')
@ApiBearerAuth()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a chess match (coach/admin only)' })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({ status: 201, description: 'Match created.' })
  @ApiResponse({ status: 400, description: 'Invalid players, status, or result.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({ status: 404, description: 'Player or tournament not found.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() createMatchDto: CreateMatchDto,
  ) {
    return this.matchesService.create(request.user.userId, createMatchDto);
  }

  @Get()
  @ApiOperation({ summary: 'List matches' })
  @ApiResponse({ status: 200, description: 'Matches ordered newest first.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  findAll() {
    return this.matchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a match by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Match found.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a match (coach/admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({ status: 200, description: 'Match updated; player ratings recalculated.' })
  @ApiResponse({ status: 400, description: 'Invalid match status or result.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({ status: 404, description: 'Match, player, or tournament not found.' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchDto: UpdateMatchDto,
  ) {
    return this.matchesService.update(
      request.user.userId,
      id,
      updateMatchDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a match (coach/admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Match deleted; player ratings recalculated.' })
  @ApiResponse({ status: 403, description: 'Coach or admin role required.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchesService.remove(request.user.userId, id);
  }
}
