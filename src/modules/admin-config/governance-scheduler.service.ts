import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AlertEvent,
  DeadlineType,
  Prisma,
  ProjectStatus,
  RegistrationPeriodStatus,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { AlertDispatchService } from './alert-dispatch.service';
import { eventForOffset, parseAlertOffsets } from '@modules/governance/governance.constants';

@Injectable()
export class GovernanceSchedulerService {
  private readonly logger = new Logger(GovernanceSchedulerService.name);
  private readonly alertWindowMs = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertDispatch: AlertDispatchService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAlerts(): Promise<void> {
    if (!this.isEnabled()) return;

    const now = new Date();
    const configs = await this.prisma.period_governance_configs.findMany({
      where: { alerts_enabled: true },
      select: {
        id: true,
        period_id: true,
        alert_offsets_days: true,
        deadlines: {
          where: { enabled: true },
          select: { id: true, deadline_at: true },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const config of configs) {
      const offsets = parseAlertOffsets(config.alert_offsets_days);
      for (const deadline of config.deadlines) {
        for (const offsetDays of offsets) {
          const targetAt = new Date(
            deadline.deadline_at.getTime() - offsetDays * 24 * 60 * 60 * 1000,
          );
          const elapsed = now.getTime() - targetAt.getTime();
          if (elapsed < 0 || elapsed >= this.alertWindowMs) continue;

          const result = await this.alertDispatch.sendAutomatic(
            deadline.id,
            eventForOffset(offsetDays) as AlertEvent,
          );
          sent += result.sent;
          skipped += result.skipped;
          failed += result.failed;
        }
      }

      await this.prisma.period_governance_configs.update({
        where: { id: config.id },
        data: { last_alert_run_at: now },
      });
    }

    if (sent || skipped || failed) {
      this.logger.log(
        `Deadline alerts: sent=${sent}, skipped=${skipped}, failed=${failed}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async escalatePendingRegistrations(): Promise<void> {
    if (!this.isEnabled()) return;

    const expired = await this.prisma.period_deadlines.findMany({
      where: {
        type: DeadlineType.TEACHER_APPROVAL,
        enabled: true,
        deadline_at: { lte: new Date() },
      },
      select: { period_id: true },
    });
    const periodIds = [...new Set(expired.map((item) => item.period_id))];
    if (!periodIds.length) return;

    const result = await this.prisma.project.updateMany({
      where: {
        status: ProjectStatus.PENDING,
        deleted_at: null,
        topics: { period_id: { in: periodIds } },
      },
      data: { status: ProjectStatus.WAITING_SECRETARY },
    });
    if (result.count) {
      this.logger.log(
        `Escalated ${result.count} registrations to WAITING_SECRETARY`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markMissingReports(): Promise<void> {
    if (!this.isEnabled()) return;

    const deadlines = await this.prisma.period_deadlines.findMany({
      where: {
        type: DeadlineType.PERIODIC_REPORT,
        enabled: true,
        deadline_at: { lte: new Date() },
      },
      select: {
        id: true,
        period_id: true,
        seq: true,
        label: true,
        deadline_at: true,
      },
    });

    let created = 0;
    for (const deadline of deadlines) {
      const projects = await this.prisma.project.findMany({
        where: {
          deleted_at: null,
          status: { in: [ProjectStatus.APPROVED, ProjectStatus.ASSIGNED] },
          topics: { period_id: deadline.period_id },
        },
        select: { student_id: true, teacher_id: true },
      });
      if (!projects.length) continue;

      const existing = await this.prisma.progress_reports.findMany({
        where: {
          deadline_id: deadline.id,
          student_id: { in: projects.map((project) => project.student_id) },
        },
        select: { student_id: true },
      });
      const existingStudentIds = new Set(
        existing.map((report) => report.student_id),
      );
      const now = new Date();
      const rows: Prisma.progress_reportsCreateManyInput[] = projects
        .filter((project) => !existingStudentIds.has(project.student_id))
        .map((project) => ({
          title: `Thiếu báo cáo định kỳ - ${deadline.label}`,
          content: `Sinh viên chưa nộp báo cáo theo mốc ${deadline.label}.`,
          month: deadline.deadline_at.getMonth() + 1,
          year: deadline.deadline_at.getFullYear(),
          period_id: deadline.period_id,
          deadline_id: deadline.id,
          status: ReportStatus.MISSING,
          student_id: project.student_id,
          teacher_id: project.teacher_id,
          missing_marked_at: now,
          updated_at: now,
        }));

      if (rows.length) {
        const result = await this.prisma.progress_reports.createMany({
          data: rows,
          skipDuplicates: true,
        });
        created += result.count;
      }
    }

    if (created) this.logger.log(`Marked ${created} missing progress reports`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updatePeriodStatuses(): Promise<void> {
    if (!this.isEnabled()) return;

    const now = new Date();
    const opened = await this.prisma.registration_periods.updateMany({
      where: {
        status: RegistrationPeriodStatus.UPCOMING,
        start_date: { lte: now },
      },
      data: {
        status: RegistrationPeriodStatus.OPEN,
        updated_at: now,
      },
    });

    const expiredFinalDeadlines = await this.prisma.period_deadlines.findMany({
      where: {
        type: DeadlineType.FINAL_SUBMISSION,
        seq: 1,
        enabled: true,
        deadline_at: { lte: now },
      },
      select: { period_id: true },
    });
    const periodIds = expiredFinalDeadlines.map((item) => item.period_id);
    const closed = periodIds.length
      ? await this.prisma.registration_periods.updateMany({
          where: {
            id: { in: periodIds },
            status: RegistrationPeriodStatus.OPEN,
          },
          data: {
            status: RegistrationPeriodStatus.CLOSED,
            updated_at: now,
          },
        })
      : { count: 0 };

    if (opened.count || closed.count) {
      this.logger.log(
        `Period statuses: opened=${opened.count}, closed=${closed.count}`,
      );
    }
  }

  private isEnabled(): boolean {
    // Opt-in rõ ràng để dev/test không vô tình gửi email tới dữ liệu thật.
    return process.env.GOVERNANCE_SCHEDULER_ENABLED === 'true';
  }
}
