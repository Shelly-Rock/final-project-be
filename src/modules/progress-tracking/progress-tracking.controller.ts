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
import { ProgressTrackingService } from './progress-tracking.service';
import {
  CreateTemplateDto,
  TemplateQueryDto,
  CreateReportDto,
  ReviewReportDto,
  ReportQueryDto,
  UpdateStudentProgressDto,
  StudentProgressQueryDto,
  CreateNotificationDto,
  NotificationQueryDto,
} from './progress-tracking.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@Controller('progress-tracking')
@UseGuards(JwtAuthGuard)
export class ProgressTrackingController {
  constructor(private readonly service: ProgressTrackingService) {}

  // ========== Template Endpoints ==========

  @Post('templates')
  createTemplate(
    @Body('teacher_id') teacherId: number,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.service.createTemplate(teacherId, dto);
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
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteTemplate(id);
  }

  // ========== Report Endpoints ==========

  @Post('reports')
  createReport(@Body('student_id') studentId: number, @Body() dto: CreateReportDto) {
    return this.service.createReport(studentId, dto);
  }

  @Get('reports')
  getReports(@Query() query: ReportQueryDto) {
    return this.service.getReports(query);
  }

  @Get('reports/:id')
  getReportById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getReportById(id);
  }

  @Put('reports/:id/review')
  reviewReport(
    @Param('id', ParseIntPipe) id: number,
    @Body('reviewer_id') reviewerId: number,
    @Body() dto: ReviewReportDto,
  ) {
    return this.service.reviewReport(id, reviewerId, dto);
  }

  // ========== Student Progress Endpoints ==========

  @Get('students/progress')
  getStudentProgress(@Query() query: StudentProgressQueryDto) {
    return this.service.getStudentProgress(query);
  }

  @Get('students/progress/:studentId')
  getStudentProgressById(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.getStudentProgressById(studentId);
  }

  @Put('students/:studentId/progress')
  updateStudentProgress(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: UpdateStudentProgressDto,
  ) {
    return this.service.updateStudentProgress(studentId, dto);
  }

  @Get('students/:studentId/progress')
  getOrCreateStudentProgress(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.service.getOrCreateStudentProgress(studentId);
  }

  // ========== Notification Endpoints ==========

  @Post('notifications')
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.service.createNotification(dto);
  }

  @Get('notifications')
  getNotifications(
    @Query('recipient_id') recipientId: number,
    @Query() query: NotificationQueryDto,
  ) {
    return this.service.getNotifications(recipientId, query);
  }

  @Put('notifications/:id/read')
  markNotificationAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markNotificationAsRead(id);
  }

  @Put('notifications/read-all')
  markAllNotificationsAsRead(@Query('recipient_id') recipientId: number) {
    return this.service.markAllNotificationsAsRead(recipientId);
  }

  @Get('notifications/unread-count')
  getUnreadNotificationCount(@Query('recipient_id') recipientId: number) {
    return this.service.getUnreadNotificationCount(recipientId);
  }

  // ========== Stats Endpoints ==========

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get('stats/ban-warnings')
  getBanWarnings() {
    return this.service.getBanWarnings();
  }

  @Get('stats/banned-students')
  getBannedStudents() {
    return this.service.getBannedStudents();
  }

  // ========== Admin Actions ==========

  @Post('admin/check-bans')
  @HttpCode(HttpStatus.OK)
  checkAndBanInactiveStudents() {
    return this.service.checkAndBanInactiveStudents();
  }
}
