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
import { CommitteeService } from './committee.service';
import {
  CreateCommitteeDto,
  UpdateCommitteeDto,
  CommitteeQueryDto,
} from './committee.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@Controller('committees')
@UseGuards(JwtAuthGuard)
export class CommitteeController {
  constructor(private readonly service: CommitteeService) {}

  // Create new committee
  @Post()
  createCommittee(@Body() dto: CreateCommitteeDto) {
    return this.service.createCommittee(dto);
  }

  // Get all committees
  @Get()
  getCommittees(@Query() query: CommitteeQueryDto) {
    return this.service.getCommittees(query);
  }

  // Get all available teachers
  @Get('teachers/available')
  getAvailableTeachers(@Query('faculty_id') facultyId?: string) {
    return this.service.getAvailableTeachers(facultyId);
  }

  // Get all external reviewers
  @Get('teachers/external-reviewers')
  getExternalReviewers(@Query('faculty_id') facultyId?: string) {
    return this.service.getExternalReviewers(facultyId);
  }

  @Get('teachers/:teacherId/conflicts')
  getTeacherConflicts(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('committee_id') committeeId?: string,
  ) {
    return this.service.getTeacherConflicts(
      teacherId,
      committeeId ? Number(committeeId) : undefined,
    );
  }

  // Get excluded teachers (teachers already in other committees)
  @Get('teachers/excluded')
  getExcludedTeachers(@Query('committee_id') committeeId?: number) {
    return this.service.getExcludedTeachers(committeeId);
  }

  // Get committee by ID
  @Get(':id')
  getCommitteeById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCommitteeById(id);
  }

  // Update committee
  @Put(':id')
  updateCommittee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommitteeDto,
  ) {
    return this.service.updateCommittee(id, dto);
  }

  // Delete committee
  @Delete(':id')
  deleteCommittee(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCommittee(id);
  }

  // Get committee stats
  @Get('stats/summary')
  getStats(@Query('faculty_id') facultyId?: string, @Query('period_id') periodIdStr?: string) {
    const periodId = periodIdStr ? parseInt(periodIdStr) : undefined;
    return this.service.getStats(facultyId, periodId);
  }
}
