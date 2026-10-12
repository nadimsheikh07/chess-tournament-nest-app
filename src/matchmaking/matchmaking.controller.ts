import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { CreateMatchmakingDto } from './dto/create-matchmaking.dto';
import { UpdateMatchmakingDto } from './dto/update-matchmaking.dto';

@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post()
  create(@Body() createMatchmakingDto: CreateMatchmakingDto) {
    return this.matchmakingService.create(createMatchmakingDto);
  }

  @Get()
  findAll() {
    return this.matchmakingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchmakingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMatchmakingDto: UpdateMatchmakingDto) {
    return this.matchmakingService.update(+id, updateMatchmakingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.matchmakingService.remove(+id);
  }
}
