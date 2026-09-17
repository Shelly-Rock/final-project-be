import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AlertEvent,
  AlertRecipientRole,
  AlertStatus,
  DeadlineType,
  Prisma,
  ProjectStatus,
  TeacherStatus,
} from '@prisma/client';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { EmailService } from '@modules/email/email.service';
import {
  DEADLINE_CTA_PATHS,
  DEADLINE_PENDING_ACTIONS,
  DEADLINE_TYPE_LABELS,
} from '@modules/governance/governance.constants';
import { DeadlinePolicyService } from '@modules/governance/deadline-policy.service';
import { SendDeadlineAlertsDto } from './dto';

export interface AlertRecipient {
  role: AlertRecipientRole;
  /** Teacher.id, Student.id hoặc Secretary.id â€” không phải User.id. */
  id: number;
  email: string;
  name: string;
}

export interface AlertDispatchResult {
  matched: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: Array<{ recipientId: number; email: string; message: string }>;
}

type AlertDeadline = {
  id: number;
  period_id: number;
  type: DeadlineType;
  seq: number;
  label: string;
  deadline_at: Date;
};

@Injectable()
export class AlertDispatchService {
  private readonly logger = new Logger(AlertDispatchService.name);
  private readonly staleClaimMs = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly deadlinePolicy: DeadlinePolicyService,
  ) {}

  async sendManual(dto: SendDeadlineAlertsDto): Promise<AlertDispatchResult> {
    const deadline = await this.getDeadline(
      dto.periodId,
      dto.deadlineType,
      dto.deadlineSeq ?? 1,
    );
    let recipients = await this.resolveRecipients(deadline, dto.recipientRole);
    if (dto.recipientIds?.length) {
      const selected = new Set(dto.recipientIds);
      recipients = recipients.filter((recipient) => selected.has(recipient.id));
    }

    return this.sendBatch(deadline, dto.event, recipients);
  }

  /** Scheduler gọi method này sau khi đã kiỒm tra kill-switch. */
  async sendAutomatic(
    deadlineId: number,
    event: AlertEvent,
  ): Promise<AlertDispatchResult> {
    const deadline = await this.prisma.period_deadlines.findUnique({
      where: { id: deadlineId },
      select: {
        id: true,
        period_id: true,
        type: true,
        seq: true,
        label: true,
        deadline_at: true,
        enabled: true,
        config: { select: { alerts_enabled: true } },
      },
    });
    if (!deadline) {
      throw new NotFoundException(`Không tìm thấy deadline có id ${deadlineId}.`);
    }
    if (!deadline.enabled || !deadline.config.alerts_enabled) {
      return { matched: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
    }

    const recipients = await this.resolveRecipients(deadline);
    return this.sendBatch(deadline, event, recipients);
  }

  async resolveRecipients(
    deadline: AlertDeadline,
    requestedRole?: AlertRecipientRole,
  ): Promise<AlertRecipient[]> {
    if (requestedRole === AlertRecipientRole.SECRETARY) {
      return this.resolveSecretaries();
    }

    switch (deadline.type) {
      case DeadlineType.TOPIC_CREATION:
        return requestedRole && requestedRole !== AlertRecipientRole.TEACHER
          ? []
          : this.resolveTeachersBelowQuota(deadline.period_id);
      case DeadlineType.STUDENT_REGISTRATION:
        return requestedRole && requestedRole !== AlertRecipientRole.STUDENT
          ? []
          : this.resolveStudentsWithoutProject();
      case DeadlineType.TEACHER_APPROVAL:
        return requestedRole && requestedRole !== AlertRecipientRole.TEACHER
          ? []
          : this.resolveTeachersWithPendingRegistrations(deadline.period_id);
      case DeadlineType.PERIODIC_REPORT:
        return requestedRole && requestedRole !== AlertRecipientRole.STUDENT
          ? []
          : this.resolveStudentsMissingReport(deadline.period_id, deadline.id);
      case DeadlineType.FINAL_SUBMISSION:
        return requestedRole && requestedRole !== AlertRecipientRole.STUDENT
          ? []
          : this.resolveStudentsMissingFinalSubmission(deadline.period_id);
      default:
        return [];
    }
  }

  async sendBatch(
    deadline: AlertDeadline,
    event: AlertEvent,
    recipients: AlertRecipient[],
  ): Promise<AlertDispatchResult> {
    const result: AlertDispatchResult = {
      matched: recipients.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const recipient of recipients) {
      const claim = await this.claimAlert(deadline.id, event, recipient);
      if (!claim) {
        result.skipped++;
        continue;
      }

      try {
        await this.emailService.sendDeadlineAlert({
          to: recipient.email,
          recipientName: recipient.name,
          stageLabel: deadline.label || DEADLINE_TYPE_LABELS[deadline.type],
          deadlineAt: deadline.deadline_at,
          pendingAction: DEADLINE_PENDING_ACTIONS[deadline.type],
          ctaUrl: DEADLINE_CTA_PATHS[deadline.type],
          event,
        });

        await this.prisma.deadline_alert_logs.update({
          where: { id: claim.id },
          data: {
            status: AlertStatus.SENT,
            sent_at: new Date(),
            error: null,
          },
        });
        result.sent++;
      } catch (error) {
        const message = this.errorMessage(error);
        await this.prisma.deadline_alert_logs.updateMany({
          where: { id: claim.id, status: AlertStatus.PROCESSING },
          data: { status: AlertStatus.FAILED, error: message },
        });
        result.failed++;
        result.errors.push({
          recipientId: recipient.id,
          email: recipient.email,
          message,
        });
      }
    }

    return result;
  }

  /**
   * Claim atomically:
   * - row mới: CREATE PROCESSING;
   * - SENT: luôn skip;
   * - FAILED: một worker duy nhất đổi FAILED -> PROCESSING;
   * - PROCESSING ci hơn 15 phút: cho phép worker phục hồi;
   * - PROCESSING đang chạy: skip.
   */
  private async claimAlert(
    deadlineId: number,
    event: AlertEvent,
    recipient: AlertRecipient,
  ): Promise<{ id: number } | null> {
    const key = {
      deadline_id_event_recipient_role_recipient_id: {
        deadline_id: deadlineId,
        event,
        recipient_role: recipient.role,
        recipient_id: recipient.id,
      },
    } as const;

    try {
      return await this.prisma.deadline_alert_logs.create({
        data: {
          deadline_id: deadlineId,
          event,
          recipient_role: recipient.role,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          status: AlertStatus.PROCESSING,
          claimed_at: new Date(),
        },
        select: { id: true },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
    }

    const existing = await this.prisma.deadline_alert_logs.findUnique({
      where: key,
      select: { id: true, status: true, claimed_at: true },
    });
    if (!existing || existing.status === AlertStatus.SENT) return null;

    const now = new Date();
    const staleBefore = new Date(now.getTime() - this.staleClaimMs);
    const claimed = await this.prisma.deadline_alert_logs.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: AlertStatus.FAILED },
          {
            status: AlertStatus.PROCESSING,
            claimed_at: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: AlertStatus.PROCESSING,
        recipient_email: recipient.email,
        error: null,
        claimed_at: now,
        attempt_count: { increment: 1 },
      },
    });

    return claimed.count === 1 ? { id: existing.id } : null;
  }

  private async resolveTeachersBelowQuota(
    periodId: number,
  ): Promise<AlertRecipient[]> {
    const config = await this.deadlinePolicy.ensureGovernanceConfig(periodId);
    const teachers = await this.prisma.teacher.findMany({
      where: { deleted_at: null, status: TeacherStatus.active },
      select: {
        id: true,
        name: true,
        email: true,
        teacher_quotas: {
          where: { period_id: periodId },
          select: { assigned_quota: true },
          take: 1,
        },
      },
    });
    if (teachers.length === 0) return [];

    const counts = await this.prisma.topics.groupBy({
      by: ['teacher_id'],
      where: {
        period_id: periodId,
        teacher_id: { in: teachers.map((teacher) => teacher.id) },
        status: { not: 'REJECTED' },
      },
      _count: { _all: true },
    });
    const countByTeacher = new Map(
      counts.map((item) => [item.teacher_id, item._count._all]),
    );

    return teachers
      .filter((teacher) => {
        const quota =
          teacher.teacher_quotas[0]?.assigned_quota ??
          config.default_topic_limit;
        return (countByTeacher.get(teacher.id) ?? 0) < quota;
      })
      .map((teacher) => ({
        role: AlertRecipientRole.TEACHER,
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      }));
  }

  private async resolveStudentsWithoutProject(): Promise<AlertRecipient[]> {
    const students = await this.prisma.student.findMany({
      where: { deleted_at: null, project: null },
      select: {
        id: true,
        email: true,
        first_name: true,
        middle_name: true,
        last_name: true,
      },
    });
    return students.map((student) => ({
      role: AlertRecipientRole.STUDENT,
      id: student.id,
      email: student.email,
      name: this.studentName(student),
    }));
  }

  private async resolveTeachersWithPendingRegistrations(
    periodId: number,
  ): Promise<AlertRecipient[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        deleted_at: null,
        topics: {
          some: {
            period_id: periodId,
            projects: { some: { status: ProjectStatus.PENDING } },
          },
        },
      },
      select: { id: true, email: true, name: true },
    });
    return teachers.map((teacher) => ({
      role: AlertRecipientRole.TEACHER,
      id: teacher.id,
      email: teacher.email,
      name: teacher.name,
    }));
  }

  private async resolveStudentsMissingReport(
    periodId: number,
    deadlineId: number,
  ): Promise<AlertRecipient[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        deleted_at: null,
        status: { in: [ProjectStatus.APPROVED, ProjectStatus.ASSIGNED] },
        topics: { period_id: periodId },
      },
      select: {
        student: {
          select: {
            id: true,
            email: true,
            first_name: true,
            middle_name: true,
            last_name: true,
          },
        },
      },
    });
    if (projects.length === 0) return [];

    const completedReports = await this.prisma.progress_reports.findMany({
      where: {
        deadline_id: deadlineId,
        student_id: { in: projects.map(({ student }) => student.id) },
        deleted_at: null,
      },
      select: { student_id: true },
    });
    const completedStudentIds = new Set(
      completedReports.map((report) => report.student_id),
    );

    return projects
      .filter(({ student }) => !completedStudentIds.has(student.id))
      .map(({ student }) => ({
        role: AlertRecipientRole.STUDENT,
        id: student.id,
        email: student.email,
        name: this.studentName(student),
      }));
  }

  private async resolveStudentsMissingFinalSubmission(
    periodId: number,
  ): Promise<AlertRecipient[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        deleted_at: null,
        status: { in: [ProjectStatus.APPROVED, ProjectStatus.ASSIGNED] },
        topics: { period_id: periodId, final_submissions: null },
      },
      select: {
        student: {
          select: {
            id: true,
            email: true,
            first_name: true,
            middle_name: true,
            last_name: true,
          },
        },
      },
    });

    return projects.map(({ student }) => ({
      role: AlertRecipientRole.STUDENT,
      id: student.id,
      email: student.email,
      name: this.studentName(student),
    }));
  }

  private async resolveSecretaries(): Promise<AlertRecipient[]> {
    const secretaries = await this.prisma.secretary.findMany({
      where: { deleted_at: null, user: { is_active: true, deleted_at: null } },
      select: {
        id: true,
        secretary_id: true,
        user: { select: { email: true, username: true } },
      },
    });
    return secretaries.map((secretary) => ({
      role: AlertRecipientRole.SECRETARY,
      id: secretary.id,
      email: secretary.user.email,
      name: secretary.user.username || secretary.secretary_id,
    }));
  }

  private async getDeadline(
    periodId: number,
    type: DeadlineType,
    seq: number,
  ): Promise<AlertDeadline> {
    const deadline = await this.deadlinePolicy.getDeadline(periodId, type, seq);
    if (!deadline) {
      throw new NotFoundException(
        `Không tìm thấy deadline ${type} (mốc ${seq}) trong đợt ${periodId}.`,
      );
    }
    return deadline;
  }

  private studentName(student: {
    first_name: string;
    middle_name: string;
    last_name: string;
  }): string {
    return [student.last_name, student.middle_name, student.first_name]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(message);
    return message.slice(0, 2_000);
  }
}


