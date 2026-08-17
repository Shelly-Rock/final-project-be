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
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import {
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
} from './submission.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private readonly service: SubmissionService) {}

  // Student submits final work
  @Post()
  createSubmission(@Body() dto: CreateSubmissionDto) {
    return this.service.createSubmission(dto);
  }

  // Get all submissions (secretary/admin)
  @Get()
  getSubmissions(@Query() query: SubmissionQueryDto) {
    return this.service.getSubmissions(query);
  }

  // Get eligible students for submission
  @Get('eligible-students')
  getEligibleStudents() {
    return this.service.getEligibleStudents();
  }

  // Get submission by ID
  @Get(':id')
  getSubmissionById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSubmissionById(id);
  }

  // Review submission (approve/reject)
  @Put(':id/review')
  reviewSubmission(
    @Param('id', ParseIntPipe) id: number,
    @Body('reviewer_id') reviewerId: number,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.service.reviewSubmission(id, reviewerId, dto);
  }

  // Get submission stats
  @Get('stats/summary')
  getStats() {
    return this.service.getStats();
  }
}
