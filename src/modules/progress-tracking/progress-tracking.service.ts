import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  ReportStatus,
  ProgressStatus,
  NotificationType,
  CreateTemplateDto,
  TemplateQueryDto,
  CreateReportDto,
  ReviewReportDto,
  ReportQueryDto,
  UpdateStudentProgressDto,
  StudentProgressQueryDto,
  CreateNotificationDto,
  NotificationQueryDto,
  BanWarningDto,
} from './progress-tracking.dto';

@Injectable()
export class ProgressTrackingService {
  constructor(private prisma: PrismaService) {}

  // ========== Template Methods ==========

  async createTemplate(teacherId: number, dto: CreateTemplateDto) {
    return this.prisma.report_templates.create({
      data: {
        ...dto,
        teacher_id: teacherId,
        updated_at: new Date(),
      },
    });
  }

  async getTemplates(query: TemplateQueryDto) {
    const { page = 1, limit = 20, type, teacher_id } = query;

    const where: any = { deleted_at: null };
    if (type) where.type = type;
    if (teacher_id) where.teacher_id = teacher_id;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.report_templates.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.report_templates.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTemplateById(id: number) {
    const template = await this.prisma.report_templates.findFirst({
      where: { id, deleted_at: null },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async deleteTemplate(id: number) {
    const template = await this.getTemplateById(id);
    return this.prisma.report_templates.update({
      where: { id: template.id },
      data: { deleted_at: new Date() },
    });
  }

  // ========== Report Methods ==========

  async createReport(studentId: number, dto: CreateReportDto) {
    // Check if report for this month/year already exists
    const existingReport = await this.prisma.progress_reports.findFirst({
      where: {
        student_id: studentId,
        month: dto.month,
        year: dto.year,
        deleted_at: null,
      },
    });

    if (existingReport) {
      throw new BadRequestException('Report for this month already submitted');
    }

    // Get project info for teacher_id
    const project = await this.prisma.project.findUnique({
      where: { student_id: studentId },
    });

    if (!project) {
      throw new BadRequestException('Student has no project');
    }

    const report = await this.prisma.progress_reports.create({
      data: {
        ...dto,
        student_id: studentId,
        teacher_id: project.teacher_id,
        updated_at: new Date(),
      },
    });

    // Update student progress
    await this.updateStudentReportCount(studentId);

    // Send notification to teacher
    await this.createNotification({
      type: NotificationType.REPORT_SUBMITTED,
      title: 'Sinh viên nộp báo cáo',
      message: `Sinh viên đã nộp báo cáo tháng ${dto.month}/${dto.year}`,
      sender_id: studentId,
      recipient_id: project.teacher_id,
      related_student_id: studentId,
      related_report_id: report.id,
    });

    return report;
  }

  async getReports(query: ReportQueryDto) {
    const { page = 1, limit = 20, status, student_id, teacher_id } = query;

    const where: any = { deleted_at: null };
    if (status) where.status = status;
    if (student_id) where.student_id = student_id;
    if (teacher_id) where.teacher_id = teacher_id;

    const skip = (page - 1) * limit;

    const data = await this.prisma.progress_reports.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.progress_reports.count({ where });

    // Transform data with student name (simple join not available, fetch separately)
    const transformedData = await Promise.all(
      data.map(async (report: any) => {
        const student = await this.prisma.student.findUnique({
          where: { id: report.student_id },
          select: { first_name: true, middle_name: true, last_name: true, student_id: true },
        });
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: report.teacher_id },
          select: { name: true },
        });
        return {
          ...report,
          student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
          studentMssv: student?.student_id,
          teacher_name: teacher?.name,
        };
      }),
    );

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReportById(id: number) {
    const report = await this.prisma.progress_reports.findFirst({
      where: { id, deleted_at: null },
    }) as any;
    if (!report) throw new NotFoundException('Report not found');

    // Get student and teacher info
    const student = await this.prisma.student.findUnique({
      where: { id: report.student_id },
      select: { first_name: true, middle_name: true, last_name: true, student_id: true },
    });
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: report.teacher_id },
      select: { name: true },
    });

    return {
      ...report,
      student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
      teacher_name: teacher?.name,
    };
  }

  async reviewReport(reportId: number, reviewerId: number, dto: ReviewReportDto) {
    const report = await this.prisma.progress_reports.findFirst({
      where: { id: reportId },
    });

    if (!report) throw new NotFoundException('Report not found');

    const updatedReport = await this.prisma.progress_reports.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        feedback: dto.feedback,
        score: dto.score,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      },
    });

    // Send notification to student
    const notificationType =
      dto.status === ReportStatus.APPROVED
        ? NotificationType.REPORT_APPROVED
        : dto.status === ReportStatus.REJECTED
        ? NotificationType.REPORT_REJECTED
        : NotificationType.STATUS_CHANGED;

    await this.createNotification({
      type: notificationType,
      title: dto.status === ReportStatus.APPROVED ? 'Báo cáo được duyệt' : 'Báo cáo bị từ chối',
      message: `Báo cáo "${report.title}" đã được duyệt với điểm: ${dto.score ?? 'N/A'}. ${
        dto.feedback ? `Phản hồi: ${dto.feedback}` : ''
      }`,
      sender_id: reviewerId,
      recipient_id: report.student_id,
      related_student_id: report.student_id,
      related_report_id: reportId,
    });

    return updatedReport;
  }

  // ========== Student Progress Methods ==========

  async getStudentProgress(query: StudentProgressQueryDto) {
    const { page = 1, limit = 20, status, is_banned, teacher_id } = query;

    const where: any = {};
    if (status) where.status = status;
    if (is_banned !== undefined) where.is_banned = is_banned;

    const skip = (page - 1) * limit;

    const data = await this.prisma.student_progress.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.student_progress.count({ where });

    // Transform and enrich data
    const transformedData = await Promise.all(
      (data as any[]).map(async (item: any) => {
        const student = await this.prisma.student.findUnique({
          where: { id: item.student_id },
          select: { first_name: true, middle_name: true, last_name: true, student_id: true, class_name: true },
        });
        const project = await this.prisma.project.findFirst({
          where: { student_id: item.student_id },
        });
        const teacher = project
          ? await this.prisma.teacher.findUnique({ where: { id: project.teacher_id }, select: { name: true } })
          : null;
        return {
          ...item,
          student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
          student_mssv: student?.student_id,
          topic_name: project?.project_name,
          teacher_name: teacher?.name,
        };
      }),
    );

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStudentProgressById(studentId: number) {
    const progress = await this.prisma.student_progress.findFirst({
      where: { student_id: studentId },
    }) as any;
    if (!progress) throw new NotFoundException('Student progress not found');

    // Get student info
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { first_name: true, middle_name: true, last_name: true, student_id: true, class_name: true },
    });

    return {
      ...progress,
      student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
      student_mssv: student?.student_id,
    };
  }

  async updateStudentProgress(studentId: number, dto: UpdateStudentProgressDto) {
    let progress = await this.prisma.student_progress.findFirst({
      where: { student_id: studentId },
    });

    if (!progress) {
      // Create if not exists
      progress = await this.prisma.student_progress.create({
        data: {
          student_id: studentId,
          status: dto.status || ProgressStatus.ON_TRACK,
          updated_at: new Date(),
        },
      });
      return progress;
    }

    const updateData: any = { ...dto };

    // Handle ban
    if (dto.status === ProgressStatus.BANNED && !progress.is_banned) {
      updateData.is_banned = true;
      updateData.banned_at = new Date();
      updateData.ban_reason = dto.ban_reason || 'Không nộp báo cáo';

      // Send ban notification
      await this.createNotification({
        type: NotificationType.BAN_APPLIED,
        title: 'Bạn bị cấm thi',
        message: `Bạn đã bị cấm thi với lý do: ${dto.ban_reason || 'Không nộp báo cáo'}`,
        sender_id: null,
        recipient_id: studentId,
        related_student_id: studentId,
      });
    }

    // Send status change notification
    if (dto.status && dto.status !== progress.status) {
      await this.createNotification({
        type: NotificationType.STATUS_CHANGED,
        title: 'Trạng thái thay đổi',
        message: `Trạng thái tiến độ của bạn đã được thay đổi thành: ${this.getStatusLabel(dto.status)}`,
        sender_id: null,
        recipient_id: studentId,
        related_student_id: studentId,
      });
    }

    return this.prisma.student_progress.update({
      where: { id: progress.id },
      data: updateData,
    });
  }

  async getOrCreateStudentProgress(studentId: number) {
    let progress = await this.prisma.student_progress.findFirst({
      where: { student_id: studentId },
    });

    if (!progress) {
      progress = await this.prisma.student_progress.create({
        data: {
          student_id: studentId,
          status: ProgressStatus.ON_TRACK,
          total_reports_required: 6,
          updated_at: new Date(),
        },
      });
    }

    return progress;
  }

  // ========== Notification Methods ==========

  async createNotification(dto: CreateNotificationDto) {
    return this.prisma.progress_notifications.create({
      data: dto as any,
    });
  }

  async getNotifications(recipientId: number, query: NotificationQueryDto) {
    const { page = 1, limit = 20, is_read, type } = query;

    const where: any = { recipient_id: recipientId };
    if (is_read !== undefined) where.is_read = is_read;
    if (type) where.type = type;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.progress_notifications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.progress_notifications.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markNotificationAsRead(id: number) {
    return this.prisma.progress_notifications.update({
      where: { id },
      data: { is_read: true },
    });
  }

  async markAllNotificationsAsRead(recipientId: number) {
    return this.prisma.progress_notifications.updateMany({
      where: { recipient_id: recipientId, is_read: false },
      data: { is_read: true },
    });
  }

  async getUnreadNotificationCount(recipientId: number) {
    return this.prisma.progress_notifications.count({
      where: { recipient_id: recipientId, is_read: false },
    });
  }

  // ========== Stats Methods ==========

  async getStats() {
    const [total, onTrack, extended, topicChanged, banned, pending, approved, rejected] =
      await Promise.all([
        this.prisma.student_progress.count(),
        this.prisma.student_progress.count({ where: { status: ProgressStatus.ON_TRACK } }),
        this.prisma.student_progress.count({ where: { status: ProgressStatus.EXTENDED } }),
        this.prisma.student_progress.count({ where: { status: ProgressStatus.TOPIC_CHANGED } }),
        this.prisma.student_progress.count({ where: { is_banned: true } }),
        this.prisma.progress_reports.count({ where: { status: ReportStatus.PENDING } }),
        this.prisma.progress_reports.count({ where: { status: ReportStatus.APPROVED } }),
        this.prisma.progress_reports.count({ where: { status: ReportStatus.REJECTED } }),
      ]);

    return {
      total_students: total,
      on_track: onTrack,
      extended: extended,
      topic_changed: topicChanged,
      banned: banned,
      pending_reports: pending,
      approved_reports: approved,
      rejected_reports: rejected,
    };
  }

  async getBanWarnings(): Promise<BanWarningDto[]> {
    const warnings: BanWarningDto[] = [];

    // Get students who haven't submitted reports recently
    const progressRecords = await this.prisma.student_progress.findMany({
      where: {
        is_banned: false,
        status: 'ON_TRACK',
      },
    });

    for (const progress of progressRecords as any[]) {
      const lastReportDate = progress.last_report_date;
      if (!lastReportDate) {
        // Get student info
        const student = await this.prisma.student.findUnique({
          where: { id: progress.student_id },
          select: { first_name: true, middle_name: true, last_name: true },
        });

        // Never submitted a report - calculate from created_at
        const daysSinceCreation = Math.floor(
          (Date.now() - progress.created_at.getTime()) / (1000 * 60 * 60 * 24),
        );
        const daysUntilBan = 30 - daysSinceCreation;

        if (daysUntilBan <= 7) {
          warnings.push({
            student_id: progress.student_id,
            student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
            days_until_ban: Math.max(0, daysUntilBan),
            reports_submitted: progress.total_reports_submitted,
            reports_required: progress.total_reports_required,
          });
        }
      }
    }

    return warnings;
  }

  async getBannedStudents() {
    const bannedRecords = await this.prisma.student_progress.findMany({
      where: { is_banned: true },
    });

    // Enrich with student info
    const enrichedRecords = await Promise.all(
      (bannedRecords as any[]).map(async (record) => {
        const student = await this.prisma.student.findUnique({
          where: { id: record.student_id },
          select: { first_name: true, middle_name: true, last_name: true, student_id: true, class_name: true },
        });
        return {
          ...record,
          student_name: student ? `${student.first_name} ${student.middle_name} ${student.last_name}` : '',
          student_mssv: student?.student_id,
        };
      }),
    );

    return enrichedRecords;
  }

  // ========== Auto Ban Check ==========

  async checkAndBanInactiveStudents(): Promise<number[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find students with no reports in 30 days
    const inactiveProgress = await this.prisma.student_progress.findMany({
      where: {
        is_banned: false,
        OR: [
          { last_report_date: { lt: thirtyDaysAgo } },
          {
            last_report_date: null,
            created_at: { lt: thirtyDaysAgo },
          },
        ],
      },
    });

    const banned: number[] = [];

    for (const progress of inactiveProgress) {
      await this.updateStudentProgress(progress.student_id, {
        status: ProgressStatus.BANNED,
        ban_reason: 'Không nộp báo cáo trong 30 ngày',
      });
      banned.push(progress.student_id);
    }

    return banned;
  }

  // ========== Helper Methods ==========

  private async updateStudentReportCount(studentId: number) {
    const count = await this.prisma.progress_reports.count({
      where: { student_id: studentId, deleted_at: null },
    });

    await this.prisma.student_progress.updateMany({
      where: { student_id: studentId },
      data: {
        total_reports_submitted: count,
        last_report_date: new Date(),
      },
    });
  }

  private getStatusLabel(status: ProgressStatus): string {
    const labels: Record<string, string> = {
      ON_TRACK: 'Tiến hành',
      EXTENDED: 'Gia hạn',
      TOPIC_CHANGED: 'Đổi đề tài',
      BANNED: 'Cấm thi',
    };
    return labels[status] || status;
  }
}
