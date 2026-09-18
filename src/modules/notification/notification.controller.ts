import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request as NestRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwtAuth.guard';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, MarkAsReadDto, NotificationDto } from './dto';
import { Permissions } from '@core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@core/auth/guards/permissions.guard';
import { PrismaService } from '@core/database/prisma/prisma.service';

@ApiTags('Notifications')
@ApiExtraModels(CreateNotificationDto)
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Permissions('notification:create')
  @ApiOperation({ summary: 'Create a new notification' })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationDto> {
    return this.notificationService.create(createNotificationDto);
  }

  @Post('batch')
  @Permissions('notification:create')
  @ApiOperation({ summary: 'Create multiple notifications at once' })
  async createBatch(
    @Body() notifications: CreateNotificationDto[],
  ): Promise<NotificationDto[]> {
    return this.notificationService.createMultiple(notifications);
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  async getMyNotifications(
    @NestRequest() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ): Promise<{
    notifications: NotificationDto[];
    total: number;
    page: number;
    limit: number;
    unreadCount: number;
  }> {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const { notifications, total } = await this.notificationService.findByRecipient(
      req.user.id,
      skip,
      limitNum,
    );

    const unreadCount = await this.notificationService.getUnreadCount(req.user.id);

    return {
      notifications,
      total,
      page: pageNum,
      limit: limitNum,
      unreadCount,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  async getUnreadCount(@NestRequest() req): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationService.getUnreadCount(req.user.id);
    return { unreadCount };
  }

  @Get('users/:role')
  @Permissions('notification:send')
  @ApiOperation({ summary: 'Get users by role for recipient selection' })
  async getUsersByRole(
    @Param('role') role: string,
  ): Promise<{ users: Array<{ id: number; name: string; email: string }> }> {
    const users = await this.notificationService.getUsersByRole(role as 'STUDENT' | 'TEACHER');
    return { users };
  }

  @Patch('mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(
    @Body() dto: MarkAsReadDto,
  ): Promise<{ message: string }> {
    await this.notificationService.markAsRead(dto.notificationIds);
    return { message: 'Notifications marked as read' };
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllAsRead(@NestRequest() req): Promise<{ message: string }> {
    await this.notificationService.markAllAsRead(req.user.id);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.notificationService.delete(parseInt(id));
    return { message: 'Notification deleted' };
  }



  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('notification:send')
  @ApiOperation({ summary: 'Send notification to users' })
  async sendNotification(
    @NestRequest() req,
    @Body()
    body: {
      title: string;
      message: string;
      type: string;
      recipientIds: number[];
      relatedStudentId?: number;
      relatedReportId?: number;
    },
  ): Promise<NotificationDto[]> {
    return this.notificationService.sendNotification(
      body.title,
      body.message,
      body.type as any,
      body.recipientIds,
      req.user.id,
      body.relatedStudentId,
      body.relatedReportId,
    );
  }

  @Delete('all')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:delete')
  @ApiOperation({ summary: 'Delete all notifications for current user' })
  async deleteAll(@NestRequest() req): Promise<{ message: string }> {
    await this.notificationService.deleteAllForUser(req.user.id);
    return { message: 'All notifications deleted' };
  }

  @Get('drafts')
  @ApiOperation({ summary: 'Get draft notifications for current user' })
  async getDrafts(@NestRequest() req): Promise<{ drafts: any[] }> {
    const drafts = await this.notificationService.getDrafts(req.user.id);
    return { drafts };
  }

  @Post('drafts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save notification as draft' })
  async saveDraft(
    @NestRequest() req,
    @Body()
    body: {
      title: string;
      message: string;
      type: string;
      priority: string;
      recipientIds: number[];
      fileName?: string;
      fileUrl?: string;
      fileSize?: number;
    },
  ): Promise<any> {
    return this.notificationService.saveDraft(
      body.title,
      body.message,
      body.type,
      body.priority,
      body.recipientIds,
      req.user.id,
      body.fileName,
      body.fileUrl,
      body.fileSize,
    );
  }

  @Get('drafts/:id')
  @ApiOperation({ summary: 'Get draft by ID' })
  async getDraftById(@Param('id') id: string): Promise<any> {
    return this.notificationService.getDraftById(parseInt(id));
  }

  @Patch('drafts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update draft notification' })
  async updateDraft(
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      message: string;
      type: string;
      priority: string;
      recipientIds: number[];
      fileName?: string;
      fileUrl?: string;
      fileSize?: number;
    },
  ): Promise<any> {
    return this.notificationService.updateDraft(
      parseInt(id),
      body.title,
      body.message,
      body.type,
      body.priority,
      body.recipientIds,
      body.fileName,
      body.fileUrl,
      body.fileSize,
    );
  }

  @Delete('drafts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete draft notification' })
  async deleteDraft(@Param('id') id: string): Promise<{ message: string }> {
    await this.notificationService.deleteDraft(parseInt(id));
    return { message: 'Draft deleted' };
  }

  @Post('drafts/:id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:send')
  @ApiOperation({ summary: 'Publish draft notification' })
  async publishDraft(@Param('id') id: string): Promise<NotificationDto[]> {
    return this.notificationService.publishDraft(parseInt(id));
  }

  @Get('compose/departments')
  @ApiOperation({ summary: 'Get departments for recipient selection' })
  async getDepartments(): Promise<{
    departments: Array<{ id: string; name: string }>;
  }> {
    const departments = await this.notificationService.getDepartments();
    return { departments };
  }

  @Get('compose/departments/:deptId/users')
  @ApiOperation({ summary: 'Get users by department' })
  async getUsersByDepartment(
    @Param('deptId') deptId: string,
  ): Promise<{
    users: Array<{ id: number; name: string; email: string; role: string }>;
  }> {
    const users = await this.notificationService.getUsersByDepartment(deptId);
    return { users };
  }

  @Get('compose/stats')
  @ApiOperation({ summary: 'Get notification statistics for dashboard' })
  async getNotificationStats(): Promise<{
    total: number;
    urgent: number;
    avgReadRate: number;
    pending: number;
  }> {
    return this.notificationService.getNotificationStats();
  }

  @Post('compose/send')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('notification:send')
  @ApiOperation({ summary: 'Compose and send notification' })
  async composeAndSend(
    @NestRequest() req,
    @Body()
    body: {
      title: string;
      message: string;
      type: string;
      priority: string;
      recipientIds: number[];
      saveDraft?: boolean;
      attachmentUrl?: string;
    },
  ): Promise<{
    message: string;
    notifications?: NotificationDto[];
    draftId?: number;
  }> {
    if (body.saveDraft) {
      const draft = await this.notificationService.saveDraft(
        body.title,
        body.message,
        body.type,
        body.priority,
        body.recipientIds,
        req.user.id,
        body.attachmentUrl,
      );
      return {
        message: 'Notification saved as draft',
        draftId: draft.id,
      };
    }

    const notifications = await this.notificationService.sendNotification(
      body.title,
      body.message,
      body.type,
      body.recipientIds,
      req.user.id,
    );

    return {
      message: 'Notification sent successfully',
      notifications,
    };
  }
}
