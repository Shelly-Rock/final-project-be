import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { DeadlinePolicyService } from '@/modules/governance/deadline-policy.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AuditAction, AuditEntityType } from '@prisma/client';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
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
  NotificationQueryDto,
  TimelineQueryDto,
  BanWarningDto,
} from './progress-tracking.dto';
import { CreateNotificationDto } from '@/modules/notification/dto';

@Injectable()
export class ProgressTrackingService {
  constructor(
    private prisma: PrismaService,
    private readonly deadlinePolicy: DeadlinePolicyService,
    private readonly audit: AuditService,
  ) {}

  // ========== Actor resolution (JWT sub -> profile id) ==========

  private async resolveTeacherByUserId(userId: number) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: {
        id: true,
        user_id: true,
        teacher_id: true,
        name: true,
        department_id: true,
      },
    });
    if (!teacher) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ giảng viên.',
      );
    }
    return teacher;
  }

  private async resolveStudentByUserId(userId: number) {
    const student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, user_id: true, student_id: true, class_name: true },
    });

    if (!student) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ sinh viên. Vui lòng liên hệ Thư ký để được hỗ trợ.',
      );
    }
    return student;
  }

  private async resolveSecretaryByUserId(userId: number) {
    const secretary = await this.prisma.secretary.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, user_id: true, department_id: true },
    });
    if (!secretary) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ thư ký.',
      );
    }
    return secretary;
  }

  async createTemplateForActor(user: JwtUser, dto: CreateTemplateDto) {
    const secretary = await this.resolveSecretaryByUserId(user.sub);
    if (!secretary.department_id) {
      throw new BadRequestException('Thư ký chưa được phân bổ về ngành nào.');
    }
    return this.createTemplate(secretary.department_id, dto);
  }

  async cloneTemplates(
    user: JwtUser,
    fromPeriodId: number,
    toPeriodId: number,
  ) {
    const secretary = await this.resolveSecretaryByUserId(user.sub);
    if (!secretary.department_id) {
      throw new BadRequestException('Thư ký chưa được phân bổ về ngành nào.');
    }

    const templatesToClone = await this.prisma.report_templates.findMany({
      where: {
        department_id: secretary.department_id,
        period_id: fromPeriodId,
        deleted_at: null,
      },
    });

    if (!templatesToClone.length) {
      throw new BadRequestException(
        'Không tìm thấy mẫu nào trong đợt cũ để sao chép.',
      );
    }

    const newTemplates = templatesToClone.map((t: any) => ({
      name: t.name,
      description: t.description,

      file_url: t.file_url,
      file_name: t.file_name,
      file_size: t.file_size,
      department_id: t.department_id,
      period_id: toPeriodId,
      is_cloned: true,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await this.prisma.report_templates.createMany({
      data: newTemplates,
    });

    return { message: `Đã sao chép ${newTemplates.length} templates.` };
  }

  async createReportForActor(user: JwtUser, dto: CreateReportDto) {
    const student = await this.resolveStudentByUserId(user.sub);
    return this.createReport(student.id, dto);
  }

  async reviewReportForActor(
    user: JwtUser,
    reportId: number,
    dto: ReviewReportDto,
  ) {
    const teacher = await this.resolveTeacherByUserId(user.sub);
    return this.reviewReport(reportId, teacher.id, dto, user.sub);
  }

  async archiveReportForActor(user: JwtUser, reportId: number) {
    const secretary = await this.resolveSecretaryByUserId(user.sub);
    return this.archiveReport(reportId, secretary.id, user.sub);
  }

  // Derive notification recipient profile id from JWT (role-aware).
  // progress_notifications.recipient_id is a profile id (teacher/student), not users.id.
  async getNotificationsForActor(user: JwtUser, query: NotificationQueryDto) {
    const role = (user.role || '').toUpperCase();
    if (role === 'STUDENT') {
      const student = await this.resolveStudentByUserId(user.sub);
      return this.getNotifications(student.id, query);
    }
    if (role === 'TEACHER') {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.getNotifications(teacher.id, query);
    }
    // ADMIN / SECRETARY: fall back to teacher profile if linked, else use users.id
    try {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.getNotifications(teacher.id, query);
    } catch {
      return this.getNotifications(user.sub, query);
    }
  }

  async markAllNotificationsAsReadForActor(user: JwtUser) {
    const role = (user.role || '').toUpperCase();
    if (role === 'STUDENT') {
      const student = await this.resolveStudentByUserId(user.sub);
      return this.markAllNotificationsAsRead(student.id);
    }
    if (role === 'TEACHER') {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.markAllNotificationsAsRead(teacher.id);
    }
    try {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.markAllNotificationsAsRead(teacher.id);
    } catch {
      return this.markAllNotificationsAsRead(user.sub);
    }
  }

  async getUnreadNotificationCountForActor(user: JwtUser) {
    const role = (user.role || '').toUpperCase();
    if (role === 'STUDENT') {
      const student = await this.resolveStudentByUserId(user.sub);
      return this.getUnreadNotificationCount(student.id);
    }
    if (role === 'TEACHER') {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.getUnreadNotificationCount(teacher.id);
    }
    try {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      return this.getUnreadNotificationCount(teacher.id);
    } catch {
      return this.getUnreadNotificationCount(user.sub);
    }
  }

  // ========== Template Methods ==========

  async createTemplate(departmentId: string, dto: CreateTemplateDto) {
    const { deadline_ids, ...templateData } = dto;

    const newTemplate = await this.prisma.report_templates.create({
      data: {
        ...templateData,
        department_id: departmentId,
        updated_at: new Date(),
      } as any,
    });

    if (deadline_ids && deadline_ids.length > 0) {
      await this.prisma.period_deadlines.updateMany({
        where: { id: { in: deadline_ids } },
        data: { template_id: newTemplate.id } as any,
      });
    }

    return newTemplate;
  }

  async getTemplates(query: TemplateQueryDto) {
    const {
      page = 1,
      limit = 20,
      department_id,
      period_id,
      is_exception,
    } = query;

    const where: any = { deleted_at: null };
    if (department_id) where.department_id = department_id;
    if (period_id) where.period_id = period_id;
    if (is_exception !== undefined) {
      if (is_exception) {
        where.deadlines = { none: {} };
      } else {
        where.deadlines = { some: {} };
      }
    }

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
    const now = new Date();
    const finalMonth = dto.month || now.getMonth() + 1;
    const finalYear = dto.year || now.getFullYear();
    const finalContent = dto.content || '';

    // Get project info for teacher_id + period (for deadline gate)
    const project = (await this.prisma.project.findUnique({
      where: { student_id: studentId },
      include: { topics: { select: { period_id: true } } },
    })) as any;

    if (!project) {
      throw new BadRequestException('Student has no project');
    }

    // if it has a deadline_id, verify it belongs to the period and is enabled
    if (dto.deadline_id) {
      const deadline = await this.prisma.period_deadlines.findUnique({
        where: { id: dto.deadline_id },
      });
      if (
        !deadline ||
        !deadline.enabled ||
        deadline.period_id !== project.topics?.period_id
      ) {
        throw new BadRequestException(
          'Mốc thời gian không hợp lệ hoặc đã bị khóa.',
        );
      }
    }

    // Enforce PERIODIC_REPORT deadline when the project is linked to a period
    const periodId: number | null = project.topics?.period_id ?? null;
    let reportDeadlineId: number | null = dto.deadline_id || null;
    let reportPeriodId: number | null = dto.period_id || periodId;

    if (!reportDeadlineId && periodId) {
      const openDeadline = await this.deadlinePolicy.assertReportOpen(periodId);
      reportDeadlineId = openDeadline?.id ?? null;
      reportPeriodId = periodId;
    }

    // Check unique submission for this deadline if deadline_id is provided
    if (reportDeadlineId) {
      const existingForDeadline = await this.prisma.progress_reports.findFirst({
        where: {
          student_id: studentId,
          deadline_id: reportDeadlineId,
          deleted_at: null,
        },
      });
      if (existingForDeadline) {
        throw new BadRequestException(
          'Bạn đã nộp báo cáo cho mốc thời gian này rồi.',
        );
      }
    }

    const report = await this.prisma.progress_reports.create({
      data: {
        ...dto,
        month: finalMonth,
        year: finalYear,
        content: finalContent,
        student_id: studentId,
        teacher_id: project.teacher_id,
        period_id: reportPeriodId,
        deadline_id: reportDeadlineId,
        updated_at: new Date(),
      } as any,
    });

    // Update student progress
    await this.updateStudentReportCount(studentId);

    // Send notification to teacher
    await this.createNotification({
      type: NotificationType.REPORT_SUBMITTED,
      title: 'Sinh viên nộp báo cáo / đơn từ',
      message: `Sinh viên đã nộp: ${dto.title}`,
      sender_id: studentId,
      recipient_id: project.teacher_id,
      related_student_id: studentId,
      related_report_id: report.id,
    });

    return report;
  }

  async getReports(query: ReportQueryDto, user?: JwtUser) {
    const { page = 1, limit = 20, status, student_id, teacher_id } = query;

    const where: any = { deleted_at: null };
    if (status) where.status = status;
    if (student_id) where.student_id = student_id;

    // If caller is teacher, enforce their profile ID
    const role = (user?.role || '').toUpperCase();
    if (role === 'TEACHER' && user?.sub) {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      where.teacher_id = teacher.id;
    } else if (teacher_id) {
      where.teacher_id = teacher_id;
    }

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
          select: {
            first_name: true,
            middle_name: true,
            last_name: true,
            student_id: true,
          },
        });
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: report.teacher_id },
          select: { name: true },
        });
        return {
          ...report,
          student_name: student
            ? `${student.first_name} ${student.middle_name} ${student.last_name}`
            : '',
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
    const report = (await this.prisma.progress_reports.findFirst({
      where: { id, deleted_at: null },
    })) as any;
    if (!report) throw new NotFoundException('Report not found');

    // Get student and teacher info
    const student = await this.prisma.student.findUnique({
      where: { id: report.student_id },
      select: {
        first_name: true,
        middle_name: true,
        last_name: true,
        student_id: true,
      },
    });
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: report.teacher_id },
      select: { name: true },
    });

    return {
      ...report,
      student_name: student
        ? `${student.first_name} ${student.middle_name} ${student.last_name}`
        : '',
      teacher_name: teacher?.name,
    };
  }

  async reviewReport(
    reportId: number,
    reviewerId: number,
    dto: ReviewReportDto,
    actorUserId: number,
  ) {
    const report = await this.prisma.progress_reports.findFirst({
      where: { id: reportId },
    });

    if (!report) throw new NotFoundException('Report not found');

    const beforeData = {
      status: report.status,
      feedback: report.feedback,
      score: report.score,
      reviewed_by: report.reviewed_by,
      reviewed_at: report.reviewed_at?.toISOString() ?? null,
    };

    let newStatus = dto.status || report.status;
    if (dto.action === 'APPROVE') {
      newStatus = ReportStatus.APPROVED_BY_TEACHER;
    } else if (dto.action === 'REJECT') {
      newStatus = ReportStatus.REVISION_REQUESTED;
    }

    const updatedReport = await this.prisma.progress_reports.update({
      where: { id: reportId },
      data: {
        status: newStatus,
        feedback: dto.feedback,
        score: dto.score,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      } as any,
    });

    const afterData = {
      status: updatedReport.status,
      feedback: updatedReport.feedback,
      score: updatedReport.score,
      reviewed_by: updatedReport.reviewed_by,
      reviewed_at: updatedReport.reviewed_at?.toISOString() ?? null,
    };

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.REPORT,
      entity_id: reportId,
      before_data: beforeData,
      after_data: afterData,
      reason: dto.feedback
        ? `Review: ${dto.feedback.substring(0, 100)}`
        : 'Report reviewed',
    });

    // Send notification to student
    const notificationType =
      newStatus === ReportStatus.APPROVED_BY_TEACHER
        ? NotificationType.REPORT_APPROVED
        : newStatus === ReportStatus.REVISION_REQUESTED
          ? NotificationType.REPORT_REJECTED
          : NotificationType.STATUS_CHANGED;

    await this.createNotification({
      type: notificationType,
      title:
        newStatus === ReportStatus.APPROVED_BY_TEACHER
          ? 'Báo cáo được duyệt'
          : 'Báo cáo bị từ chối',
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

  async archiveReport(
    reportId: number,
    secretaryId: number,
    actorUserId: number,
  ) {
    const report = await this.prisma.progress_reports.findFirst({
      where: { id: reportId },
    });

    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.APPROVED_BY_TEACHER) {
      throw new BadRequestException(
        'Chỉ có thể lưu trữ báo cáo đã được giảng viên duyệt.',
      );
    }

    const beforeData = {
      status: report.status,
      archived_by: (report as any).archived_by,
      archived_at: (report as any).archived_at?.toISOString() ?? null,
    };

    const updatedReport = await this.prisma.progress_reports.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.ARCHIVED,
        archived_by: secretaryId,
        archived_at: new Date(),
      } as any,
    });

    const afterData = {
      status: updatedReport.status,
      archived_by: updatedReport.archived_by,
      archived_at: updatedReport.archived_at?.toISOString() ?? null,
    };

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.REPORT,
      entity_id: reportId,
      before_data: beforeData,
      after_data: afterData,
      reason: 'Báo cáo được thư ký lưu trữ',
    });

    return updatedReport;
  }

  // ========== Student Progress Methods ==========

  async getStudentProgress(query: StudentProgressQueryDto, user?: JwtUser) {
    const { page = 1, limit = 20, status, is_banned, teacher_id } = query;

    const where: any = {};
    if (status) where.status = status;
    if (is_banned !== undefined) where.is_banned = is_banned;

    let targetTeacherId = teacher_id;
    const role = (user?.role || '').toUpperCase();
    if (role === 'TEACHER' && user?.sub) {
      const teacher = await this.resolveTeacherByUserId(user.sub);
      targetTeacherId = teacher.id;
    }

    if (targetTeacherId) {
      const projects = await this.prisma.project.findMany({
        where: {
          teacher_id: targetTeacherId,
          status: 'APPROVED',
          deleted_at: null,
        },
        select: { id: true, student_id: true },
      });
      const studentIds = [
        ...new Set(projects.map((project) => project.student_id)),
      ];
      where.student_id = { in: studentIds };
    }

    where.deleted_at = null;

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
          select: {
            first_name: true,
            middle_name: true,
            last_name: true,
            student_id: true,
            class_name: true,
          },
        });
        const project = await this.prisma.project.findFirst({
          where: {
            student_id: item.student_id,
            ...(targetTeacherId ? { teacher_id: targetTeacherId } : {}),
            status: 'APPROVED',
            deleted_at: null,
          },
        });
        const teacher = project
          ? await this.prisma.teacher.findUnique({
              where: { id: project.teacher_id },
              select: { name: true },
            })
          : null;
        return {
          ...item,
          student_name: student
            ? `${student.first_name} ${student.middle_name} ${student.last_name}`
            : '',
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

  async getMyProgress(userId: number) {
    const student = await this.resolveStudentByUserId(userId);
    const project = await this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
    });
    if (!project) {
      return {};
    }
    await this.getOrCreateStudentProgress(student.id);
    return this.getStudentProgressById(student.id);
  }

  async getStudentProgressById(studentId: number, returnNullIfMissing = false) {
    const progress = (await this.prisma.student_progress.findFirst({
      where: { student_id: studentId },
    })) as any;
    if (!progress) {
      if (returnNullIfMissing) return {};
      throw new NotFoundException('Student progress not found');
    }

    // Get student info
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        first_name: true,
        middle_name: true,
        last_name: true,
        student_id: true,
        class_name: true,
      },
    });
    const project = await this.prisma.project.findFirst({
      where: { student_id: studentId, deleted_at: null },
    });
    const teacher = project
      ? await this.prisma.teacher.findUnique({
          where: { id: project.teacher_id },
          select: { name: true },
        })
      : null;

    return {
      ...progress,
      student_name: student
        ? `${student.first_name} ${student.middle_name} ${student.last_name}`
        : '',
      student_mssv: student?.student_id,
      topic_name: project?.project_name,
      teacher_name: teacher?.name,
    };
  }

  async updateStudentProgress(
    studentId: number,
    dto: UpdateStudentProgressDto,
  ) {
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

  private async getTeacherStudentScope(user?: JwtUser) {
    if ((user?.role || '').toUpperCase() !== 'TEACHER' || !user.sub) {
      return undefined;
    }

    const teacher = await this.resolveTeacherByUserId(user.sub);
    const projects = await this.prisma.project.findMany({
      where: {
        teacher_id: teacher.id,
        status: 'APPROVED',
        deleted_at: null,
      },
      select: { student_id: true },
    });

    return {
      studentIds: [...new Set(projects.map((project) => project.student_id))],
    };
  }

  async getStats(user?: JwtUser) {
    const scope = await this.getTeacherStudentScope(user);
    const studentWhere = {
      deleted_at: null,
      ...(scope ? { student_id: { in: scope.studentIds } } : {}),
    };
    const reportWhere = scope
      ? {
          status: {
            in: [
              ReportStatus.PENDING,
              ReportStatus.APPROVED,
              ReportStatus.REJECTED,
            ],
          },
          student_id: { in: scope.studentIds },
        }
      : undefined;

    const [
      total,
      onTrack,
      extended,
      topicChanged,
      banned,
      pending,
      approved,
      rejected,
    ] = await Promise.all([
      this.prisma.student_progress.count({ where: studentWhere }),
      this.prisma.student_progress.count({
        where: { ...studentWhere, status: ProgressStatus.ON_TRACK },
      }),
      this.prisma.student_progress.count({
        where: { ...studentWhere, status: ProgressStatus.EXTENDED },
      }),
      this.prisma.student_progress.count({
        where: { ...studentWhere, status: ProgressStatus.TOPIC_CHANGED },
      }),
      this.prisma.student_progress.count({
        where: { ...studentWhere, is_banned: true },
      }),
      this.prisma.progress_reports.count({
        where: reportWhere
          ? { ...reportWhere, status: ReportStatus.PENDING }
          : { status: ReportStatus.PENDING },
      }),
      this.prisma.progress_reports.count({
        where: reportWhere
          ? { ...reportWhere, status: ReportStatus.APPROVED }
          : { status: ReportStatus.APPROVED },
      }),
      this.prisma.progress_reports.count({
        where: reportWhere
          ? { ...reportWhere, status: ReportStatus.REJECTED }
          : { status: ReportStatus.REJECTED },
      }),
    ]);

    return {
      total_students: total,
      on_track: onTrack,
      extended,
      topic_changed: topicChanged,
      banned,
      pending_reports: pending,
      approved_reports: approved,
      rejected_reports: rejected,
    };
  }

  async getBanWarnings(user?: JwtUser): Promise<BanWarningDto[]> {
    const scope = await this.getTeacherStudentScope(user);
    const warnings: BanWarningDto[] = [];

    // Get students who haven't submitted reports recently
    const progressRecords = await this.prisma.student_progress.findMany({
      where: {
        deleted_at: null,
        is_banned: false,
        status: 'ON_TRACK',
        ...(scope ? { student_id: { in: scope.studentIds } } : {}),
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
            student_name: student
              ? `${student.first_name} ${student.middle_name} ${student.last_name}`
              : '',
            days_until_ban: Math.max(0, daysUntilBan),
            reports_submitted: progress.total_reports_submitted,
            reports_required: progress.total_reports_required,
          });
        }
      }
    }

    return warnings;
  }

  async getBannedStudents(user?: JwtUser) {
    const scope = await this.getTeacherStudentScope(user);
    const bannedRecords = await this.prisma.student_progress.findMany({
      where: {
        deleted_at: null,
        is_banned: true,
        ...(scope ? { student_id: { in: scope.studentIds } } : {}),
      },
    });

    // Enrich with student info
    const enrichedRecords = await Promise.all(
      (bannedRecords as any[]).map(async (record) => {
        const student = await this.prisma.student.findUnique({
          where: { id: record.student_id },
          select: {
            first_name: true,
            middle_name: true,
            last_name: true,
            student_id: true,
            class_name: true,
          },
        });
        return {
          ...record,
          student_name: student
            ? `${student.first_name} ${student.middle_name} ${student.last_name}`
            : '',
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

  // ========== Timeline Logic ==========

  async getTimelineForActor(user: JwtUser, query: TimelineQueryDto) {
    let studentId = query.student_id;
    const role = (user.role || '').toUpperCase();

    // Sinh viên chỉ xem timeline của mình
    if (role === 'STUDENT') {
      const student = await this.resolveStudentByUserId(user.sub);
      studentId = student.id;
    }

    let periodId = query.period_id;
    if (!periodId) {
      // Tìm đợt đang active
      const activePeriod = await this.prisma.registration_periods.findFirst({
        where: { status: { in: ['OPEN', 'UPCOMING'] } },
        orderBy: { start_date: 'desc' },
      });
      if (activePeriod) {
        periodId = activePeriod.id;
      } else {
        const latest = await this.prisma.registration_periods.findFirst({
          orderBy: { id: 'desc' },
        });
        periodId = latest?.id || 0;
      }
    }

    return this.getTimeline(periodId, studentId);
  }

  async getTimeline(periodId: number, studentId?: number) {
    const deadlines = await this.prisma.period_deadlines.findMany({
      where: { period_id: periodId, enabled: true },
      orderBy: { deadline_at: 'asc' },
      include: { template: true },
    });

    let submissions = [];
    if (studentId) {
      submissions = await this.prisma.progress_reports.findMany({
        where: { student_id: studentId, period_id: periodId, deleted_at: null },
      });
    }

    return deadlines.map((deadline: any) => {
      const submission = submissions.find((s) => s.deadline_id === deadline.id);

      return {
        id: deadline.id,
        period_id: deadline.period_id,
        type: deadline.type,
        seq: deadline.seq,
        label: deadline.label,
        deadline_at: deadline.deadline_at,
        template: deadline.template
          ? {
              id: deadline.template.id,
              name: deadline.template.name,
              file_url: deadline.template.file_url,
              file_name: deadline.template.file_name,
            }
          : null,
        submission: submission
          ? {
              id: submission.id,
              title: submission.title,
              status: submission.status,
              file_url: submission.file_url,
              file_name: submission.file_name,
              score: submission.score,
              feedback: submission.feedback,
              submitted_at: submission.created_at,
            }
          : null,
      };
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
