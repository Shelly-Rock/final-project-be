import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AlertStatus,
  DeadlineType,
  Prisma,
  TeacherQuotaStatus,
} from '@prisma/client';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { DeadlinePolicyService } from '@modules/governance/deadline-policy.service';
import {
  DEADLINE_ORDERING,
  MAX_TOPIC_LIMIT_CEILING,
  parseAlertOffsets,
} from '@modules/governance/governance.constants';
import {
  AlertLogsQueryDto,
  DeleteTeacherOverrideQueryDto,
  ListTeacherOverridesQueryDto,
  PeriodDeadlineDto,
  UpdateGovernanceConfigDto,
  UpsertTeacherOverridesDto,
} from './dto';

@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deadlinePolicy: DeadlinePolicyService,
  ) {}

  async getConfig(periodId: number) {
    const config = await this.deadlinePolicy.ensureGovernanceConfig(periodId);
    const [deadlines, governance, alertGroups] = await Promise.all([
      this.prisma.period_deadlines.findMany({
        where: { period_id: periodId },
        orderBy: [{ type: 'asc' }, { seq: 'asc' }],
      }),
      this.deadlinePolicy.getGovernanceView(periodId),
      this.prisma.deadline_alert_logs.groupBy({
        by: ['status'],
        where: { deadline: { period_id: periodId } },
        _count: { _all: true },
      }),
    ]);

    const alertStats = {
      lastRunAt: config.last_alert_run_at?.toISOString() ?? null,
      processing: 0,
      sent: 0,
      failed: 0,
    };
    for (const group of alertGroups) {
      if (group.status === AlertStatus.PROCESSING) {
        alertStats.processing = group._count._all;
      } else if (group.status === AlertStatus.SENT) {
        alertStats.sent = group._count._all;
      } else if (group.status === AlertStatus.FAILED) {
        alertStats.failed = group._count._all;
      }
    }

    return {
      config: {
        id: config.id,
        periodId: config.period_id,
        defaultTopicLimit: config.default_topic_limit,
        maxTopicLimit: config.max_topic_limit,
        maxStudentsPerTopic: config.max_students_per_topic,
        alertsEnabled: config.alerts_enabled,
        alertOffsetsDays: parseAlertOffsets(config.alert_offsets_days),
        lastAlertRunAt: config.last_alert_run_at?.toISOString() ?? null,
        updatedByUserId: config.updated_by_user_id,
        createdAt: config.created_at.toISOString(),
        updatedAt: config.updated_at.toISOString(),
      },
      deadlines: deadlines.map((deadline) => ({
        id: deadline.id,
        periodId: deadline.period_id,
        type: deadline.type,
        seq: deadline.seq,
        label: deadline.label,
        deadlineAt: deadline.deadline_at.toISOString(),
        enabled: deadline.enabled,
        createdAt: deadline.created_at.toISOString(),
        updatedAt: deadline.updated_at.toISOString(),
      })),
      alertStats,
      governance,
    };
  }

  async updateConfig(dto: UpdateGovernanceConfigDto, actorUserId: number) {
    await this.deadlinePolicy.ensureGovernanceConfig(dto.periodId);
    this.validateConfig(dto);

    const normalizedDeadlines = dto.deadlines.map((deadline) => ({
      ...deadline,
      label: deadline.label.trim(),
      deadlineAt: new Date(deadline.deadlineAt),
    }));

    await this.prisma.$transaction(
      async (tx) => {
        await tx.period_governance_configs.update({
          where: { period_id: dto.periodId },
          data: {
            default_topic_limit: dto.defaultTopicLimit,
            max_topic_limit: dto.maxTopicLimit,
            max_students_per_topic: dto.maxStudentsPerTopic,
            alerts_enabled: dto.alertsEnabled,
            alert_offsets_days: dto.alertOffsetsDays,
            updated_by_user_id: actorUserId,
          },
        });

        for (const deadline of normalizedDeadlines) {
          await tx.period_deadlines.upsert({
            where: {
              period_id_type_seq: {
                period_id: dto.periodId,
                type: deadline.type,
                seq: deadline.seq,
              },
            },
            update: {
              label: deadline.label,
              deadline_at: deadline.deadlineAt,
              enabled: deadline.enabled,
            },
            create: {
              period_id: dto.periodId,
              type: deadline.type,
              seq: deadline.seq,
              label: deadline.label,
              deadline_at: deadline.deadlineAt,
              enabled: deadline.enabled,
            },
          });
        }

        const existing = await tx.period_deadlines.findMany({
          where: { period_id: dto.periodId },
          select: { id: true, type: true, seq: true },
        });
        const incomingKeys = new Set(
          normalizedDeadlines.map((item) => `${item.type}:${item.seq}`),
        );
        const obsoleteIds = existing
          .filter((item) => !incomingKeys.has(`${item.type}:${item.seq}`))
          .map((item) => item.id);

        if (obsoleteIds.length > 0) {
          await tx.period_deadlines.deleteMany({
            where: { id: { in: obsoleteIds } },
          });
        }

        // Hai cột cũ chỉ còn để tương thích màn/API legacy; luôn mirror từ
        // nguồn authoritative để không tạo nguồn dữ liệu thứ hai.
        const topicCreation = normalizedDeadlines.find(
          (item) => item.type === DeadlineType.TOPIC_CREATION && item.seq === 1,
        );
        const studentRegistration = normalizedDeadlines.find(
          (item) =>
            item.type === DeadlineType.STUDENT_REGISTRATION && item.seq === 1,
        );
        await tx.registration_periods.update({
          where: { id: dto.periodId },
          data: {
            default_quota: dto.defaultTopicLimit,
            teacher_deadline: topicCreation.deadlineAt,
            student_deadline: studentRegistration.deadlineAt,
            updated_at: new Date(),
          },
        });

        // Override cũ không thể nằm trên trần mới.
        const invalidOverrides = await tx.teacher_quotas.count({
          where: {
            period_id: dto.periodId,
            is_override: true,
            assigned_quota: { gt: dto.maxTopicLimit },
          },
        });
        if (invalidOverrides > 0) {
          throw new BadRequestException(
            `Không thể hạ trần xuống ${dto.maxTopicLimit}: còn ${invalidOverrides} giảng viên đang có chỉ tiêu ghi đè cao hơn trần mới.`,
          );
        }
      },
      { timeout: 20_000 },
    );

    return this.getConfig(dto.periodId);
  }

  async listTeacherOverrides(query: ListTeacherOverridesQueryDto) {
    const config = await this.deadlinePolicy.ensureGovernanceConfig(
      query.periodId,
    );
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search?.trim();

    const teacherWhere: Prisma.TeacherWhereInput = {
      deleted_at: null,
      ...(query.facultyId && { faculty_id: query.facultyId }),
      ...(query.departmentId && { department_id: query.departmentId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { teacher_id: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [teachers, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where: teacherWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          teacher_id: true,
          name: true,
          email: true,
          faculty_id: true,
          department_id: true,
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.teacher.count({ where: teacherWhere }),
    ]);

    const teacherIds = teachers.map((teacher) => teacher.id);
    const [quotas, topicCounts] = teacherIds.length
      ? await Promise.all([
          this.prisma.teacher_quotas.findMany({
            where: {
              period_id: query.periodId,
              teacher_id: { in: teacherIds },
            },
          }),
          this.prisma.topics.groupBy({
            by: ['teacher_id'],
            where: {
              period_id: query.periodId,
              teacher_id: { in: teacherIds },
              status: { not: 'REJECTED' },
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const quotaByTeacher = new Map(
      quotas.map((quota) => [quota.teacher_id, quota]),
    );
    const countByTeacher = new Map(
      topicCounts.map((item) => [item.teacher_id, item._count._all]),
    );

    return {
      items: teachers.map((teacher) => {
        const quota = quotaByTeacher.get(teacher.id);
        const submittedTopics = countByTeacher.get(teacher.id) ?? 0;
        const assignedQuota =
          quota?.assigned_quota ?? config.default_topic_limit;
        return {
          ...teacher,
          assignedQuota,
          submittedTopics,
          remainingTopics: Math.max(0, assignedQuota - submittedTopics),
          maxStudents:
            quota?.max_students ??
            assignedQuota * config.max_students_per_topic,
          isOverride: quota?.is_override ?? false,
          status:
            submittedTopics >= assignedQuota ? 'SUFFICIENT' : 'INSUFFICIENT',
          lastNotifiedAt: quota?.last_notified_at?.toISOString() ?? null,
        };
      }),
      total,
      page,
      limit,
      config: {
        defaultTopicLimit: config.default_topic_limit,
        maxTopicLimit: config.max_topic_limit,
        maxStudentsPerTopic: config.max_students_per_topic,
      },
    };
  }

  async upsertTeacherOverrides(
    dto: UpsertTeacherOverridesDto,
    _actorUserId: number,
  ) {
    const config = await this.deadlinePolicy.ensureGovernanceConfig(
      dto.periodId,
    );
    if (dto.assignedQuota > config.max_topic_limit) {
      throw new BadRequestException(
        `Vượt quá trần chỉ tiêu cho phép của đợt (${config.max_topic_limit}).`,
      );
    }

    const maxStudentsPerTopic =
      dto.maxStudentsPerTopic ?? config.max_students_per_topic;
    if (maxStudentsPerTopic > config.max_students_per_topic) {
      throw new BadRequestException(
        `Sĩ số tối đa mỗi đề tài không được vượt quá ${config.max_students_per_topic}.`,
      );
    }

    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: dto.teacherIds }, deleted_at: null },
      select: { id: true },
    });
    if (teachers.length !== dto.teacherIds.length) {
      const foundIds = new Set(teachers.map((teacher) => teacher.id));
      const missingIds = dto.teacherIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Không tìm thấy giảng viên: ${missingIds.join(', ')}.`,
      );
    }

    const topicCounts = await this.prisma.topics.groupBy({
      by: ['teacher_id'],
      where: {
        period_id: dto.periodId,
        teacher_id: { in: dto.teacherIds },
        status: { not: 'REJECTED' },
      },
      _count: { _all: true },
    });
    const countByTeacher = new Map(
      topicCounts.map((item) => [item.teacher_id, item._count._all]),
    );

    const results = await this.prisma.$transaction(
      dto.teacherIds.map((teacherId) => {
        const submittedTopics = countByTeacher.get(teacherId) ?? 0;
        const status =
          submittedTopics >= dto.assignedQuota
            ? TeacherQuotaStatus.SUFFICIENT
            : TeacherQuotaStatus.INSUFFICIENT;
        return this.prisma.teacher_quotas.upsert({
          where: {
            period_id_teacher_id: {
              period_id: dto.periodId,
              teacher_id: teacherId,
            },
          },
          update: {
            assigned_quota: dto.assignedQuota,
            submitted_topics: submittedTopics,
            max_students: dto.assignedQuota * maxStudentsPerTopic,
            status,
            is_override: true,
          },
          create: {
            period_id: dto.periodId,
            teacher_id: teacherId,
            assigned_quota: dto.assignedQuota,
            submitted_topics: submittedTopics,
            max_students: dto.assignedQuota * maxStudentsPerTopic,
            status,
            is_override: true,
          },
        });
      }),
    );

    return {
      updated: results.length,
      items: results,
    };
  }

  async deleteTeacherOverride(
    teacherId: number,
    query: DeleteTeacherOverrideQueryDto,
  ) {
    const [config, teacher] = await Promise.all([
      this.deadlinePolicy.ensureGovernanceConfig(query.periodId),
      this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true },
      }),
    ]);
    if (!teacher) {
      throw new NotFoundException(
        `Không tìm thấy giảng viên có id ${teacherId}.`,
      );
    }

    const submittedTopics = await this.prisma.topics.count({
      where: {
        period_id: query.periodId,
        teacher_id: teacherId,
        status: { not: 'REJECTED' },
      },
    });
    const status =
      submittedTopics >= config.default_topic_limit
        ? TeacherQuotaStatus.SUFFICIENT
        : TeacherQuotaStatus.INSUFFICIENT;

    return this.prisma.teacher_quotas.upsert({
      where: {
        period_id_teacher_id: {
          period_id: query.periodId,
          teacher_id: teacherId,
        },
      },
      update: {
        assigned_quota: config.default_topic_limit,
        submitted_topics: submittedTopics,
        max_students:
          config.default_topic_limit * config.max_students_per_topic,
        status,
        is_override: false,
      },
      create: {
        period_id: query.periodId,
        teacher_id: teacherId,
        assigned_quota: config.default_topic_limit,
        submitted_topics: submittedTopics,
        max_students:
          config.default_topic_limit * config.max_students_per_topic,
        status,
        is_override: false,
      },
    });
  }

  async listAlertLogs(query: AlertLogsQueryDto) {
    await this.deadlinePolicy.ensureGovernanceConfig(query.periodId);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: Prisma.deadline_alert_logsWhereInput = {
      status: query.status,
      recipient_email: query.search
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
      deadline: {
        period_id: query.periodId,
        type: query.deadlineType,
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.deadline_alert_logs.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        include: {
          deadline: {
            select: {
              id: true,
              type: true,
              seq: true,
              label: true,
              deadline_at: true,
            },
          },
        },
      }),
      this.prisma.deadline_alert_logs.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private validateConfig(dto: UpdateGovernanceConfigDto): void {
    if (dto.defaultTopicLimit > dto.maxTopicLimit) {
      throw new BadRequestException(
        'Chỉ tiêu mặc định không được vượt quá trần chỉ tiêu của đợt.',
      );
    }
    if (dto.maxTopicLimit > MAX_TOPIC_LIMIT_CEILING) {
      throw new BadRequestException(
        `Trần chỉ tiêu không được vượt quá ${MAX_TOPIC_LIMIT_CEILING}.`,
      );
    }

    const keys = new Set<string>();
    const byType = new Map<DeadlineType, PeriodDeadlineDto[]>();
    for (const deadline of dto.deadlines) {
      const key = `${deadline.type}:${deadline.seq}`;
      if (keys.has(key)) {
        throw new BadRequestException(
          `Deadline ${deadline.type} thứ tự ${deadline.seq} bị trùng.`,
        );
      }
      keys.add(key);
      const items = byType.get(deadline.type) ?? [];
      items.push(deadline);
      byType.set(deadline.type, items);

      if (
        deadline.type !== DeadlineType.PERIODIC_REPORT &&
        deadline.seq !== 1
      ) {
        throw new BadRequestException(
          `Deadline ${deadline.type} chỉ được sử dụng seq = 1.`,
        );
      }
    }

    for (const type of Object.values(DeadlineType)) {
      if (!byType.has(type)) {
        throw new BadRequestException(`Thiếu cấu hình deadline ${type}.`);
      }
    }

    const dateFor = (type: DeadlineType): Date => {
      const deadline = byType.get(type).find((item) => item.seq === 1);
      if (!deadline) {
        throw new BadRequestException(`Deadline ${type} phải có seq = 1.`);
      }
      return new Date(deadline.deadlineAt);
    };

    for (let index = 0; index < DEADLINE_ORDERING.length - 1; index++) {
      const current = DEADLINE_ORDERING[index];
      const next = DEADLINE_ORDERING[index + 1];
      if (dateFor(current).getTime() >= dateFor(next).getTime()) {
        throw new BadRequestException(
          `Deadline ${current} phải trước ${next}.`,
        );
      }
    }

    const approvalAt = dateFor(DeadlineType.TEACHER_APPROVAL).getTime();
    const finalAt = dateFor(DeadlineType.FINAL_SUBMISSION).getTime();
    const reportMilestones = byType.get(DeadlineType.PERIODIC_REPORT);
    const seqs = [...reportMilestones]
      .sort((a, b) => a.seq - b.seq)
      .map((item) => item.seq);
    seqs.forEach((seq, index) => {
      if (seq !== index + 1) {
        throw new BadRequestException(
          'Thứ tự các mốc báo cáo định kỳ phải liên tục từ 1.',
        );
      }
    });

    let previous = approvalAt;
    for (const milestone of [...reportMilestones].sort(
      (a, b) => a.seq - b.seq,
    )) {
      const milestoneAt = new Date(milestone.deadlineAt).getTime();
      if (milestoneAt <= previous || milestoneAt >= finalAt) {
        throw new BadRequestException(
          'Mỗi mốc báo cáo định kỳ phải sau hạn duyệt của giảng viên, trước hạn nộp cuối kỳ và theo đúng thứ tự.',
        );
      }
      previous = milestoneAt;
    }
  }
}
