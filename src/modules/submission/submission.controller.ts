import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubmissionService } from './submission.service';
import {
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
  InitDriveUploadDto,
  ConfirmDriveUploadDto,
} from './submission.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionController {
  constructor(private readonly service: SubmissionService) {}

  // Get current student's submissions
  @Get('my')
  @Roles('STUDENT')
  getMySubmissions(@CurrentUser() user: JwtUser) {
    return this.service.getMySubmissions(user);
  }

  @Get('my/eligibility')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Kiểm tra sinh viên có phải trưởng nhóm không để nộp bài' })
  getMyEligibility(@CurrentUser() user: JwtUser) {
    return this.service.getMyEligibility(user);
  }

  @Post('drive/init-upload')
  @Roles('STUDENT')
  initDriveUpload(
    @CurrentUser() user: JwtUser,
    @Body() dto: InitDriveUploadDto,
  ) {
    return this.service.initDriveUpload(user, dto);
  }

  @Post('drive/confirm')
  @Roles('STUDENT')
  confirmDriveUpload(
    @CurrentUser() user: JwtUser,
    @Body() dto: ConfirmDriveUploadDto,
  ) {
    return this.service.confirmDriveUpload(user, dto);
  }

  // Student submits final work â€” student_id suy ra từ JWT, không nhận từ body.
  @Post()
  @Roles('STUDENT')
  createSubmission(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.service.createSubmissionForActor(user, dto);
  }

  // Get all submissions (secretary/admin)
  @Get()
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  getSubmissions(@Query() query: SubmissionQueryDto) {
    return this.service.getSubmissions(query);
  }

  // Get eligible students for submission
  @Get('eligible-students')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  getEligibleStudents() {
    return this.service.getEligibleStudents();
  }

  // Get submission stats â€” MUST be declared BEFORE ':id' or ParseIntPipe swallows it.
  @Get('stats/summary')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  getStats() {
    return this.service.getStats();
  }

  // Get submission by ID
  @Get(':id')
  getSubmissionById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSubmissionById(id);
  }

  // Review submission (approve/reject) â€” reviewer_id suy ra từ JWT (Teacher profile id).
  @Put(':id/review')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  reviewSubmission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.service.reviewSubmissionForActor(user, id, dto);
  }
}

