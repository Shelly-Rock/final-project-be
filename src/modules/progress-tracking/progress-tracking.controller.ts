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
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { ProgressTrackingService } from './progress-tracking.service';
import {
  CreateTemplateDto,
  CloneTemplateDto,
  TemplateQueryDto,
  CreateReportDto,
  ReviewReportDto,
  ArchiveReportDto,
  ReportQueryDto,
  UpdateStudentProgressDto,
  StudentProgressQueryDto,
  NotificationQueryDto,
  TimelineQueryDto,
} from './progress-tracking.dto';
import { CreateNotificationDto } from '@/modules/notification/dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';

@ApiTags('Progress Tracking')
@ApiExtraModels(CreateNotificationDto)
@Controller('progress-tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressTrackingController {
  constructor(private readonly service: ProgressTrackingService) {}

  // ========== Template Endpoints ==========

  // teacher_id lấy từ JWT (resolve sang hồ sơ Teacher), không nhận từ body.
  @Post('templates')
  @Roles('SECRETARY', 'ADMIN') // Teachers shouldn't upload templates anymore based on new flow
  createTemplate(@CurrentUser() user: JwtUser, @Body() dto: CreateTemplateDto) {
    return this.service.createTemplateForActor(user, dto);
  }

  @Post('templates/clone')
  @Roles('SECRETARY', 'ADMIN')
  cloneTemplates(@CurrentUser() user: JwtUser, @Body() dto: CloneTemplateDto) {
    return this.service.cloneTemplates(
      user,
      dto.from_period_id,
      dto.to_period_id,
    );
  }

  @Get('templates')
  getTemplates(@Query() query: TemplateQueryDto) {
    return this.service.getTemplates(query);
  }

  @Get('templates/:id')
  getTemplateById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTemplateById(id);
  }

  @Delete('templates/:id')
  @Roles('ADMIN', 'SECRETARY')
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteTemplate(id);
  }

  // ========== Report Endpoints ==========

  // student_id lấy từ JWT (resolve sang hồ sơ Student), không nhận từ body.
  @Post('reports')
  @Roles('STUDENT')
  createReport(@CurrentUser() user: JwtUser, @Body() dto: CreateReportDto) {
    return this.service.createReportForActor(user, dto);
  }

  @Get('reports')
  getReports(@CurrentUser() user: JwtUser, @Query() query: ReportQueryDto) {
    return this.service.getReports(query, user);
  }

  @Get('reports/:id')
  getReportById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getReportById(id);
  }

  // reviewer_id lấy từ JWT (resolve sang hồ sơ Teacher), không nhận từ body.
  @Put('reports/:id/review')
  @Roles('TEACHER', 'ADMIN')
  reviewReport(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewReportDto,
  ) {
    return this.service.reviewReportForActor(user, id, dto);
  }

  @Put('reports/:id/archive')
  @Roles('SECRETARY', 'ADMIN')
  archiveReport(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: ArchiveReportDto,
  ) {
    return this.service.archiveReportForActor(user, id);
  }

  // ========== Student Progress Endpoints ==========

  @Get('students/my-progress')
  @Roles('STUDENT')
  async getMyProgress(@CurrentUser('sub') userId: number) {
    return this.service.getMyProgress(userId);
  }

  @Get('students/progress')
  getStudentProgress(
    @CurrentUser() user: JwtUser,
    @Query() query: StudentProgressQueryDto,
  ) {
    return this.service.getStudentProgress(query, user);
  }

  @Get('students/progress/:studentId')
  getStudentProgressById(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.getStudentProgressById(studentId);
  }

  @Put('students/:studentId/progress')
  @Roles('ADMIN', 'SECRETARY')
  updateStudentProgress(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: UpdateStudentProgressDto,
  ) {
    return this.service.updateStudentProgress(studentId, dto);
  }

  @Get('students/:studentId/progress')
  getOrCreateStudentProgress(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.service.getOrCreateStudentProgress(studentId);
  }

  // ========== Timeline Endpoints ==========

  @Get('timeline')
  getTimeline(@CurrentUser() user: JwtUser, @Query() query: TimelineQueryDto) {
    return this.service.getTimelineForActor(user, query);
  }

  // ========== Notification Endpoints ==========

  @Post('notifications')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.service.createNotification(dto);
  }

  // 'read-all' và 'unread-count' phải khai báo TRƯỚC ':id/read',
  // nếu không ParseIntPipe của ':id' sẽ nuốt route tĩnh.
  @Put('notifications/read-all')
  markAllNotificationsAsRead(@CurrentUser() user: JwtUser) {
    return this.service.markAllNotificationsAsReadForActor(user);
  }

  @Get('notifications/unread-count')
  getUnreadNotificationCount(@CurrentUser() user: JwtUser) {
    return this.service.getUnreadNotificationCountForActor(user);
  }

  @Get('notifications')
  getNotifications(
    @CurrentUser() user: JwtUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.service.getNotificationsForActor(user, query);
  }

  @Put('notifications/:id/read')
  markNotificationAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markNotificationAsRead(id);
  }

  // ========== Stats Endpoints ==========

  @Get('stats')
  getStats(@CurrentUser() user: JwtUser) {
    return this.service.getStats(user);
  }

  @Get('stats/ban-warnings')
  getBanWarnings(@CurrentUser() user: JwtUser) {
    return this.service.getBanWarnings(user);
  }

  @Get('stats/banned-students')
  getBannedStudents(@CurrentUser() user: JwtUser) {
    return this.service.getBannedStudents(user);
  }

  // ========== Admin Actions ==========

  @Post('admin/check-bans')
  @Roles('ADMIN', 'SECRETARY')
  @HttpCode(HttpStatus.OK)
  checkAndBanInactiveStudents() {
    return this.service.checkAndBanInactiveStudents();
  }
}
