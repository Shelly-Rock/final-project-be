import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeadlineType, Prisma, TopicStatus } from '@prisma/client';
import { PrismaService } from '@core/database/prisma/prisma.service';
import {
  DEADLINE_TYPE_LABELS,
  EffectiveQuota,
  GovernanceStage,
  GovernanceView,
  MAX_STUDENTS_PER_TOPIC_CEILING,
  MAX_TOPIC_LIMIT_CEILING,
  formatViDateTime,
  parseAlertOffsets,
} from './governance.constants';

type DeadlineRow = {
  id: number;
  period_id: number;
  type: DeadlineType;
  seq: number;
  label: string;
  deadline_at: Date;
  enabled: boolean;
};

export interface TopicWritableOptions {
  /** Tạo mới phải kiểm quota; sửa topic hiện có chỉ kiểm deadline. */
  checkQuota?: boolean;
  /** Sĩ số đề tài định tạo/sửa, nếu có. */
  maxStudents?: number;
}

@Injectable()
export class DeadlinePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo cấu hình mặc định theo cách idempotent cho các đợt cũ.
   * Deadline chưa được cấu hình sẽ không khoá nghiệp vụ.
   */
  async ensureGovernanceConfig(periodId: number) {
    const period = await this.prisma.registration_periods.findUnique({
      where: { id: periodId },
      select: { id: true },
    });

    if (!period) {
      throw new NotFoundException(`Không tìm thấy đợt đồ án có id ${periodId}`);
    }

    return this.prisma.period_governance_configs.upsert({
      where: { period_id: periodId },
      update: {},
      create: {
        period_id: periodId,
        default_topic_limit: 3,
        max_topic_limit: MAX_TOPIC_LIMIT_CEILING,
        max_students_per_topic: MAX_STUDENTS_PER_TOPIC_CEILING,
        alerts_enabled: true,
        alert_offsets_days: [3, 1, 0] as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Kiểm tra deadline tạo/sửa đề tài. Khi tạo mới, kiểm thêm quota GV;
   * khi chỉnh sửa topic hiện hữu, caller truyền checkQuota=false.
   */
  async assertTopicWritable(
    periodId: number,
    teacherId: number,
    options: TopicWritableOptions = {},
  ): Promise<EffectiveQuota> {
    await this.assertSingleDeadlineOpen(periodId, DeadlineType.TOPIC_CREATION);

    const quota = await this.getEffectiveQuota(periodId, teacherId);
    if (options.checkQuota !== false && quota.remainingTopics <= 0) {
      throw new ForbiddenException(
        `Giảng viên đã đạt chỉ tiêu tối đa ${quota.assignedQuota} đề tài trong đợt đăng ký này.`,
      );
    }

    if (options.maxStudents !== undefined) {
      await this.assertMaxStudentsAllowed(periodId, options.maxStudents);
    }

    return quota;
  }

  async assertRegistrationOpen(periodId: number): Promise<DeadlineRow | null> {
    return this.assertSingleDeadlineOpen(
      periodId,
      DeadlineType.STUDENT_REGISTRATION,
    );
  }

  async assertApprovalOpen(periodId: number): Promise<DeadlineRow | null> {
    return this.assertSingleDeadlineOpen(periodId, DeadlineType.TEACHER_APPROVAL);
  }

  /**
   * Trả milestone PERIODIC_REPORT gần nhất chưa hết hạn để caller gắn
   * deadline_id vào báo cáo. Nếu không cấu hình deadline thì trả null.
   */
  async assertReportOpen(periodId: number): Promise<DeadlineRow | null> {
    await this.ensureGovernanceConfig(periodId);

    const deadlines = await this.prisma.period_deadlines.findMany({
      where: {
        period_id: periodId,
        type: DeadlineType.PERIODIC_REPORT,
        enabled: true,
      },
      orderBy: [{ deadline_at: 'asc' }, { seq: 'asc' }],
      select: this.deadlineSelect(),
    });

    if (deadlines.length === 0) return null;

    const now = new Date();
    const openMilestone = deadlines.find(
      (deadline) => deadline.deadline_at.getTime() > now.getTime(),
    );
    if (openMilestone) return openMilestone;

    const lastDeadline = deadlines[deadlines.length - 1];
    throw this.closedDeadlineException(lastDeadline);
  }

  async assertFinalSubmissionOpen(
    periodId: number,
  ): Promise<DeadlineRow | null> {
    return this.assertSingleDeadlineOpen(periodId, DeadlineType.FINAL_SUBMISSION);
  }

  async assertMaxStudentsAllowed(
    periodId: number,
    maxStudents: number,
  ): Promise<void> {
    const config = await this.ensureGovernanceConfig(periodId);
    if (!Number.isInteger(maxStudents) || maxStudents < 1) {
      throw new BadRequestException('Sĩ số tối đa của đề tài phải từ 1 trở lên.');
    }

    if (maxStudents > config.max_students_per_topic) {
      throw new BadRequestException(
        `Sĩ số tối đa của đề tài không được vượt quá ${config.max_students_per_topic} sinh viên theo cấu hình đợt.`,
      );
    }
  }

  async getEffectiveQuota(
    periodId: number,
    teacherId: number,
  ): Promise<EffectiveQuota> {
    const [config, teacher] = await Promise.all([
      this.ensureGovernanceConfig(periodId),
      this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true },
      }),
    ]);

    if (!teacher) {
      throw new NotFoundException(`Không tìm thấy giảng viên có id ${teacherId}`);
    }

    const [override, usedTopics] = await Promise.all([
      this.prisma.teacher_quotas.findUnique({
        where: {
          period_id_teacher_id: {
            period_id: periodId,
            teacher_id: teacherId,
          },
        },
        select: { assigned_quota: true, is_override: true },
      }),
      this.prisma.topics.count({
        where: {
          period_id: periodId,
          teacher_id: teacherId,
          status: { not: TopicStatus.REJECTED },
        },
      }),
    ]);

    const assignedQuota = override?.assigned_quota ?? config.default_topic_limit;
    return {
      teacherId,
      assignedQuota,
      maxStudentsPerTopic: config.max_students_per_topic,
      usedTopics,
      remainingTopics: Math.max(0, assignedQuota - usedTopics),
      isOverride: override?.is_override ?? false,
    };
  }

  async getGovernanceView(periodId: number): Promise<GovernanceView> {
    const [config, period, deadlines] = await Promise.all([
      this.ensureGovernanceConfig(periodId),
      this.prisma.registration_periods.findUnique({
        where: { id: periodId },
        select: { start_date: true },
      }),
      this.prisma.period_deadlines.findMany({
        where: { period_id: periodId },
        orderBy: [{ type: 'asc' }, { seq: 'asc' }],
        select: this.deadlineSelect(),
      }),
    ]);

    const now = new Date();
    const stages: GovernanceStage[] = deadlines.map((deadline) => {
      const remainingMs = deadline.deadline_at.getTime() - now.getTime();
      let state: GovernanceStage['state'];
      if (!deadline.enabled) state = 'DISABLED';
      else if (remainingMs <= 0) state = 'CLOSED';
      else if (period && period.start_date.getTime() > now.getTime()) {
        state = 'UPCOMING';
      } else state = 'OPEN';

      return {
        id: deadline.id,
        type: deadline.type,
        seq: deadline.seq,
        label: deadline.label,
        deadlineAt: deadline.deadline_at.toISOString(),
        enabled: deadline.enabled,
        state,
        remainingMs,
      };
    });

    const isOpen = (type: DeadlineType): boolean => {
      const matching = stages.filter((stage) => stage.type === type);
      if (matching.length === 0) return true;
      const enabled = matching.filter((stage) => stage.enabled);
      if (enabled.length === 0) return true;
      return enabled.some(
        (stage) => stage.state === 'OPEN' || stage.state === 'UPCOMING',
      );
    };

    return {
      periodId,
      config: {
        defaultTopicLimit: config.default_topic_limit,
        maxTopicLimit: config.max_topic_limit,
        maxStudentsPerTopic: config.max_students_per_topic,
        alertsEnabled: config.alerts_enabled,
        alertOffsetsDays: parseAlertOffsets(config.alert_offsets_days),
        lastAlertRunAt: config.last_alert_run_at?.toISOString() ?? null,
      },
      stages,
      locks: {
        topicWritable: isOpen(DeadlineType.TOPIC_CREATION),
        registrationOpen: isOpen(DeadlineType.STUDENT_REGISTRATION),
        approvalOpen: isOpen(DeadlineType.TEACHER_APPROVAL),
        reportOpen: isOpen(DeadlineType.PERIODIC_REPORT),
        finalSubmissionOpen: isOpen(DeadlineType.FINAL_SUBMISSION),
      },
      serverTime: now.toISOString(),
    };
  }

  async getDeadline(
    periodId: number,
    type: DeadlineType,
    seq = 1,
  ): Promise<DeadlineRow | null> {
    await this.ensureGovernanceConfig(periodId);
    return this.prisma.period_deadlines.findUnique({
      where: {
        period_id_type_seq: {
          period_id: periodId,
          type,
          seq,
        },
      },
      select: this.deadlineSelect(),
    });
  }

  private async assertSingleDeadlineOpen(
    periodId: number,
    type: DeadlineType,
  ): Promise<DeadlineRow | null> {
    await this.ensureGovernanceConfig(periodId);

    // Các stage một-mốc dùng seq=1. Fallback deadline sớm nhất giúp dữ liệu
    // cũ/malformed vẫn bị khoá an toàn thay vì bỏ qua deadline.
    const deadlines = await this.prisma.period_deadlines.findMany({
      where: { period_id: periodId, type },
      orderBy: [{ seq: 'asc' }, { deadline_at: 'asc' }],
      select: this.deadlineSelect(),
    });

    const deadline =
      deadlines.find((item) => item.seq === 1) ?? deadlines[0] ?? null;
    if (!deadline || !deadline.enabled) return deadline;

    if (deadline.deadline_at.getTime() <= Date.now()) {
      throw this.closedDeadlineException(deadline);
    }

    return deadline;
  }

  private closedDeadlineException(deadline: DeadlineRow): ForbiddenException {
    const stage = DEADLINE_TYPE_LABELS[deadline.type];
    return new ForbiddenException(
      `Hạn chót ${stage.toLowerCase()} đã kết thúc (${formatViDateTime(
        deadline.deadline_at,
      )}). Vui lòng liên hệ Thư ký để được hỗ trợ.`,
    );
  }

  private deadlineSelect() {
    return {
      id: true,
      period_id: true,
      type: true,
      seq: true,
      label: true,
      deadline_at: true,
      enabled: true,
    } as const;
  }
}
