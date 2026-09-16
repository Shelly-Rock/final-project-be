import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { CreateNotificationDto, MarkAsReadDto, NotificationDto } from './dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationDto> {
    const notification = await this.prisma.progress_notifications.create({
      data: {
        type: createNotificationDto.type,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        recipient_id: createNotificationDto.recipient_id,
        sender_id: createNotificationDto.sender_id,
        related_student_id: createNotificationDto.related_student_id,
        related_report_id: createNotificationDto.related_report_id,
        is_read: false,
      },
    });

    return this.mapToDto(notification);
  }

  async createMultiple(
    notifications: CreateNotificationDto[],
  ): Promise<NotificationDto[]> {
    if (notifications.length === 0) return [];

    await this.prisma.progress_notifications.createMany({
      data: notifications.map((n) => ({
        type: n.type,
        title: n.title,
        message: n.message,
        recipient_id: n.recipient_id,
        sender_id: n.sender_id,
        related_student_id: n.related_student_id,
        related_report_id: n.related_report_id,
        is_read: false,
      })),
    });

    const createdNotifications = await this.prisma.progress_notifications.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 60000),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: notifications.length,
    });

    return createdNotifications.map((n) => this.mapToDto(n));
  }

  async findByRecipient(
    recipientId: number,
    skip?: number,
    take?: number,
  ): Promise<{ notifications: NotificationDto[]; total: number }> {
    const [notifications, total] = await Promise.all([
      this.prisma.progress_notifications.findMany({
        where: {
          recipient_id: recipientId,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.progress_notifications.count({
        where: {
          recipient_id: recipientId,
        },
      }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapToDto(n)),
      total,
    };
  }

  async getUnreadCount(recipientId: number): Promise<number> {
    return this.prisma.progress_notifications.count({
      where: {
        recipient_id: recipientId,
        is_read: false,
      },
    });
  }

  async markAsRead(notificationIds: number[]): Promise<void> {
    await this.prisma.progress_notifications.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
      data: {
        is_read: true,
      },
    });
  }

  async markAllAsRead(recipientId: number): Promise<void> {
    await this.prisma.progress_notifications.updateMany({
      where: {
        recipient_id: recipientId,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });
  }

  async delete(notificationId: number): Promise<void> {
    await this.prisma.progress_notifications.delete({
      where: {
        id: notificationId,
      },
    });
  }

  async deleteMany(notificationIds: number[]): Promise<void> {
    await this.prisma.progress_notifications.deleteMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
    });
  }

  async getUsersByRole(
    role: 'STUDENT' | 'TEACHER',
  ): Promise<Array<{ id: number; name: string; email: string }>> {
    if (role === 'STUDENT') {
      const students = await this.prisma.student.findMany({
        where: {
          user: {
            is_active: true,
          },
        },
        include: {
          user: true,
        },
      });

      return students.map((s) => ({
        id: s.user_id || 0,
        name: `${s.last_name} ${s.first_name}`,
        email: s.email,
      }));
    }

    if (role === 'TEACHER') {
      const teachers = await this.prisma.teacher.findMany({
        where: {
          user: {
            is_active: true,
          },
        },
        include: {
          user: true,
        },
      });

      return teachers.map((t) => ({
        id: t.user_id,
        name: t.name,
        email: t.email,
      }));
    }

    return [];
  }

  async sendNotification(
    title: string,
    message: string,
    type: any,
    recipientIds: number[],
    senderId?: number,
    relatedStudentId?: number,
    relatedReportId?: number,
  ): Promise<NotificationDto[]> {
    const notifications = await this.createMultiple(
      recipientIds.map((recipientId) => ({
        title,
        message,
        type: type as any,
        recipient_id: recipientId,
        sender_id: senderId,
        related_student_id: relatedStudentId,
        related_report_id: relatedReportId,
      })),
    );
    return notifications;
  }

  private mapToDto(notification: any): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: notification.is_read,
      sender_id: notification.sender_id,
      recipient_id: notification.recipient_id,
      related_student_id: notification.related_student_id,
      related_report_id: notification.related_report_id,
      created_at: notification.created_at,
    };
  }
}
