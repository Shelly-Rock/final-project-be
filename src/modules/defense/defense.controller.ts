import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { DefenseService } from './defense.service';
import {
  CreateDefenseSessionDto,
  UpdateDefenseSessionDto,
  AddProjectsToSessionDto,
  RemoveProjectFromSessionDto,
  ScoreProjectDto,
  DefenseSessionQueryDto,
} from './defense.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@Controller('defense-sessions')
@UseGuards(JwtAuthGuard)
export class DefenseController {
  constructor(private readonly service: DefenseService) {}

  // Create new defense session
  @Post()
  createDefenseSession(@Body() dto: CreateDefenseSessionDto) {
    return this.service.createDefenseSession(dto);
  }

  // Get all defense sessions
  @Get()
  getDefenseSessions(@Query() query: DefenseSessionQueryDto) {
    return this.service.getDefenseSessions(query);
  }

  // Get defense session by ID
  @Get(':id')
  getDefenseSessionById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDefenseSessionById(id);
  }

  // Update defense session
  @Put(':id')
  updateDefenseSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDefenseSessionDto,
  ) {
    return this.service.updateDefenseSession(id, dto);
  }

  // Add projects to session
  @Post(':id/projects')
  addProjectsToSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProjectsToSessionDto,
  ) {
    return this.service.addProjectsToSession(id, dto);
  }

  // Remove project from session
  @Delete(':id/projects')
  removeProjectFromSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RemoveProjectFromSessionDto,
  ) {
    return this.service.removeProjectFromSession(id, dto.project_id);
  }

  // Score a project
  @Post(':sessionProjectId/score')
  scoreProject(
    @Param('sessionProjectId', ParseIntPipe) sessionProjectId: number,
    @Body() dto: ScoreProjectDto,
  ) {
    return this.service.scoreProject(sessionProjectId, dto);
  }

  // Complete defense session
  @Put(':id/complete')
  completeDefenseSession(@Param('id', ParseIntPipe) id: number) {
    return this.service.completeDefenseSession(id);
  }

  // Delete defense session
  @Delete(':id')
  deleteDefenseSession(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDefenseSession(id);
  }

  // Export schedule to Word format
  @Get(':id/export')
  exportScheduleWord(@Param('id', ParseIntPipe) id: number) {
    return this.service.exportScheduleWord(id);
  }

  // Get defense stats
  @Get('stats/summary')
  getStats() {
    return this.service.getStats();
  }
}
