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
@Controller('notification')
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
}
