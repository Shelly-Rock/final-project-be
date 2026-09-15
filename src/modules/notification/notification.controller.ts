import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request as NestRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwtAuth.guard';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, MarkAsReadDto, NotificationDto } from './dto';
import { Permissions } from '@core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@core/auth/guards/permissions.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
  @Permissions('notification:read')
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
  }> {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const { notifications, total } = await this.notificationService.findByRecipient(
      req.user.id,
      skip,
      limitNum,
    );

    return {
      notifications,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get('unread-count')
  @Permissions('notification:read')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  async getUnreadCount(@NestRequest() req): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post('mark-as-read')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:update')
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(
    @Body() { notification_ids }: MarkAsReadDto,
  ): Promise<{ message: string }> {
    await this.notificationService.markAsRead(notification_ids);
    return { message: 'Notifications marked as read' };
  }

  @Post('mark-all-as-read')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:update')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllAsRead(@NestRequest() req): Promise<{ message: string }> {
    await this.notificationService.markAllAsRead(req.user.id);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:delete')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.notificationService.delete(parseInt(id));
    return { message: 'Notification deleted' };
  }

  @Post('delete-batch')
  @HttpCode(HttpStatus.OK)
  @Permissions('notification:delete')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  async deleteBatch(
    @Body() { notification_ids }: MarkAsReadDto,
  ): Promise<{ message: string }> {
    await this.notificationService.deleteMany(notification_ids);
    return { message: 'Notifications deleted' };
  }
}
