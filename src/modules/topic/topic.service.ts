import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeadlineType,
  Prisma,
  ProjectStatus,
  TeacherQuotaStatus,
  TopicAuditAction,
  TopicStatus,
} from '@prisma/client';
import { Workbook } from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { DeadlinePolicyService } from '@modules/governance/deadline-policy.service';
import {
  BulkModerationDto,
  CreateSupplementalTopicDto,
  CreateTopicDto,
  ForceUpdateTopicDto,
  GenerateTopicCodesDto,
  ManualAssignDto,
  RegistrationDecisionDto,
  SearchPeriodEntityQueryDto,
  TopicAvailableQueryDto,
  TopicManageQueryDto,
  UpdateTopicDto,
} from './dto';
import {
  COUNTED_PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  SLOT_OCCUPYING_PROJECT_STATUSES,
  TOPIC_STATUS_LABELS,
  formatTopicCode,
  paginate,
  registrationHeadline,
  resolveCodeYear,
  resolveDepartmentCode,
  studentFullName,
  summarizeRegistrations,
} from './topic.utils';

type Tx = Prisma.TransactionClient;

/** Số lần thử cấp mã khi mã sinh ra đã tồn tại (dữ liệu legacy). */
const CODE_ALLOCATION_MAX_ATTEMPTS = 200;

const MANAGE_INCLUDE = {
  registration_periods: { select: { id: true, name: true, school_year: true } },
  teachers: {
    select: {
      id: true,
      teacher_id: true,
      name: true,
      email: true,
      department_id: true,
      faculty_id: true,
      department: { select: { id: true, name: true } },
      faculty: { select: { id: true, name: true } },
    },
  },
  projects: {
    where: { deleted_at: null },
    orderBy: { created_at: 'asc' as const },
    select: {
      id: true,
      project_id: true,
      status: true,
      created_at: true,
      updated_at: true,
      assign_reason: true,
      moderator_note: true,
      teacher_decided_at: true,
      assigned_by_user_id: true,
      decided_by_user_id: true,
      student: {
        select: {
          id: true,
          student_id: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          class_name: true,
          email: true,
          major: true,
        },
      },
    },
  },
} satisfies Prisma.topicsInclude;

type ManagedTopic = Prisma.topicsGetPayload<{ include: typeof MANAGE_INCLUDE }>;

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deadlinePolicy: DeadlinePolicyService,
  ) {}

  // ==========================================================
  // Trạng thái governance (mọi role đã đăng nhập)
  // ==========================================================

  async getGovernanceState(periodId?: number) {
    const resolvedPeriodId = periodId ?? (await this.resolveActivePeriodId());
    return this.deadlinePolicy.getGovernanceView(resolvedPeriodId);
  }

  // ==========================================================
  // Quản trị: danh sách hợp nhất
  // ==========================================================

  async listManaged(query: TopicManageQueryDto) {
    const periodId = query.periodId ?? (await this.resolveActivePeriodId());
    const where = this.buildManageWhere({ ...query, periodId });
    const page = query.page || 1;
    const limit = query.limit || 20;

    // Facets khoa / bộ môn / GVHD phải ổn định theo TOÀN ĐỢT, không suy ra từ
    // vài dòng của trang hiện tại — nếu không, đang lọc trang 2 sẽ mất lựa chọn.
    const [topics, total, statusCounts, periodTeachers] = await Promise.all([
      this.prisma.topics.findMany({
        where,
        include: MANAGE_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
      }),
      this.prisma.topics.count({ where }),
      this.prisma.topics.groupBy({
        by: ['status'],
        where: { period_id: periodId },
        _count: { _all: true },
      }),
      this.prisma.teacher.findMany({
        where: {
          deleted_at: null,
          topics: { some: { period_id: periodId } },
        },
        select: {
          id: true,
          teacher_id: true,
          name: true,
          faculty_id: true,
          department_id: true,
          faculty: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const rows = topics.map((topic) => this.mapManagedRow(topic));

    const faculties = new Map<string, string>();
    const departments = new Map<string, { id: string; name: string; facultyId: string | null }>();
    for (const teacher of periodTeachers) {
      if (teacher.faculty_id) {
        faculties.set(teacher.faculty_id, teacher.faculty?.name ?? teacher.faculty_id);
      }
      // Bộ môn chỉ liệt kê trong phạm vi khoa đang lọc (cascade).
      if (
        teacher.department_id &&
        (!query.facultyId || teacher.faculty_id === query.facultyId)
      ) {
        departments.set(teacher.department_id, {
          id: teacher.department_id,
          name: teacher.department?.name ?? teacher.department_id,
          facultyId: teacher.faculty_id,
        });
      }
    }

    return {
      ...paginate(rows, total, page, limit),
      periodId,
      facets: {
        statuses: (Object.keys(TOPIC_STATUS_LABELS) as TopicStatus[]).map(
          (status) => ({
            value: status,
            label: TOPIC_STATUS_LABELS[status],
            count:
              statusCounts.find((item) => item.status === status)?._count
                ._all ?? 0,
          }),
        ),
        faculties: [...faculties.entries()].map(([id, name]) => ({ id, name })),
        departments: [...departments.values()],
        teachers: periodTeachers
          .filter(
            (teacher) =>
              (!query.facultyId || teacher.faculty_id === query.facultyId) &&
              (!query.departmentId || teacher.department_id === query.departmentId),
          )
          .map((teacher) => ({
            id: teacher.id,
            teacherId: teacher.teacher_id,
            name: teacher.name,
          })),
      },
    };
  }

  async exportManaged(query: TopicManageQueryDto) {
    const periodId = query.periodId ?? (await this.resolveActivePeriodId());
    const where = this.buildManageWhere({ ...query, periodId });

    // Export lấy tối đa 5.000 dòng để không kéo cả bảng xuống bộ nhớ.
    const topics = await this.prisma.topics.findMany({
      where,
      include: MANAGE_INCLUDE,
      orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
      take: 5_000,
    });

    const workbook = new Workbook();
    workbook.creator = 'Project Governance';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('De tai');

    worksheet.columns = [
      { header: 'Mã đề tài', key: 'code', width: 18 },
      { header: 'Tên đề tài', key: 'name', width: 46 },
      { header: 'GVHD', key: 'teacher', width: 26 },
      { header: 'Khoa/Bộ môn', key: 'unit', width: 30 },
      { header: 'Sĩ số tối đa', key: 'maxStudents', width: 14 },
      { header: 'Đã nhận', key: 'registered', width: 10 },
      { header: 'Danh sách SV', key: 'students', width: 52 },
      { header: 'Trạng thái đề tài', key: 'status', width: 18 },
      { header: 'Trạng thái đăng ký', key: 'registration', width: 20 },
      { header: 'Bổ sung', key: 'supplemental', width: 12 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const topic of topics) {
      const row = this.mapManagedRow(topic);
      worksheet.addRow({
        code: row.code ?? '',
        name: row.name,
        teacher: row.teacher?.name ?? '',
        unit: [row.teacher?.facultyName, row.teacher?.departmentName]
          .filter(Boolean)
          .join(' / '),
        maxStudents: row.maxStudents,
        registered: row.registeredStudents,
        students: row.students
          .map((student) => `${student.studentCode} - ${student.name}`)
          .join('; '),
        status: row.statusLabel,
        registration: row.registrationHeadline,
        supplemental: row.isSupplemental ? 'Có' : 'Không',
        createdAt: row.createdAt,
      });
    }

    const output = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);

    return {
      buffer: Buffer.from(output),
      fileName: `de-tai-dot-${periodId}-${stamp}.xlsx`,
      total: topics.length,
    };
  }

  async listStudentsWithoutTopic(query: SearchPeriodEntityQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search?.trim();

    // Schema chưa có bảng ghi danh SV theo đợt, nên "chưa có đề tài" được
    // hiểu là chưa có Project (hoặc Project đang ở trạng thái REJECTED) trên
    // toàn hệ thống. periodId vẫn được nhận để giữ contract ổn định khi
    // bảng ghi danh được bổ sung sau này.
    // `student_progress` không có relation ngược trên Student nên trạng thái
    // cấm được truy vấn riêng ở dưới.
    const finalWhere: Prisma.StudentWhereInput = {
      deleted_at: null,
      AND: [
        {
          OR: [
            { project: null },
            { project: { status: ProjectStatus.REJECTED } },
          ],
        },
        search
          ? {
              OR: [
                { student_id: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { first_name: { contains: search, mode: 'insensitive' } },
                { middle_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { class_name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where: finalWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ class_name: 'asc' }, { student_id: 'asc' }],
        select: {
          id: true,
          student_id: true,
          email: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          class_name: true,
          major: true,
          project: { select: { id: true, status: true, topic_id: true } },
        },
      }),
      this.prisma.student.count({ where: finalWhere }),
    ]);

    const bans = await this.findBanRecords(students.map((s) => s.id));
    const banByStudent = new Map(
      bans.map((ban) => [
        ban.student_id,
        { is_banned: ban.is_banned, ban_reason: ban.ban_reason },
      ]),
    );

    return paginate(
      students.map((student) => ({
        id: student.id,
        studentCode: student.student_id,
        name: studentFullName(student),
        email: student.email,
        className: student.class_name,
        major: student.major,
        isBanned: banByStudent.get(student.id)?.is_banned ?? false,
        banReason: banByStudent.get(student.id)?.ban_reason ?? null,
        currentProject: student.project
          ? {
              id: student.project.id,
              status: student.project.status,
              statusLabel: PROJECT_STATUS_LABELS[student.project.status],
              topicId: student.project.topic_id,
            }
          : null,
      })),
      total,
      page,
      limit,
    );
  }

  async listTeachersWithQuota(query: SearchPeriodEntityQueryDto) {
    const config = await this.deadlinePolicy.ensureGovernanceConfig(
      query.periodId,
    );
    const search = query.search?.trim();

    const teachers = await this.prisma.teacher.findMany({
      where: {
        deleted_at: null,
        status: 'active',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { teacher_id: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        teacher_id: true,
        name: true,
        email: true,
        department_id: true,
        faculty_id: true,
        department: { select: { id: true, name: true } },
        faculty: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    const teacherIds = teachers.map((teacher) => teacher.id);
    const [quotas, topicCounts] = teacherIds.length
      ? await Promise.all([
          this.prisma.teacher_quotas.findMany({
            where: { period_id: query.periodId, teacher_id: { in: teacherIds } },
            select: { teacher_id: true, assigned_quota: true, is_override: true },
          }),
          this.prisma.topics.groupBy({
            by: ['teacher_id'],
            where: {
              period_id: query.periodId,
              teacher_id: { in: teacherIds },
              status: { not: TopicStatus.REJECTED },
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

    const items = teachers
      .map((teacher) => {
        const quota = quotaByTeacher.get(teacher.id);
        const assignedQuota =
          quota?.assigned_quota ?? config.default_topic_limit;
        const submittedTopics = countByTeacher.get(teacher.id) ?? 0;
        return {
          id: teacher.id,
          teacherId: teacher.teacher_id,
          name: teacher.name,
          email: teacher.email,
          departmentId: teacher.department_id,
          departmentName: teacher.department?.name ?? null,
          facultyId: teacher.faculty_id,
          facultyName: teacher.faculty?.name ?? null,
          assignedQuota,
          submittedTopics,
          remainingTopics: Math.max(0, assignedQuota - submittedTopics),
          isOverride: quota?.is_override ?? false,
        };
      })
      .filter((teacher) => teacher.remainingTopics > 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;

    return {
      ...paginate(items.slice(start, start + limit), items.length, page, limit),
      config: {
        defaultTopicLimit: config.default_topic_limit,
        maxTopicLimit: config.max_topic_limit,
        maxStudentsPerTopic: config.max_students_per_topic,
      },
    };
  }

  // ==========================================================
  // Quản trị: can thiệp có audit
  // ==========================================================

  async manualAssign(dto: ManualAssignDto, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.topics.findUnique({
        where: { id: dto.topicId },
        include: {
          registration_periods: { select: { id: true, school_year: true } },
          teachers: { select: { id: true, department_id: true } },
        },
      });
      if (!topic) {
        throw new NotFoundException(
          `Không tìm thấy đề tài có id ${dto.topicId}`,
        );
      }
      if (topic.status !== TopicStatus.APPROVED) {
        throw new BadRequestException(
          'Chỉ có thể gán sinh viên vào đề tài đã được duyệt.',
        );
      }
      if (topic.locked_at) {
        throw new ConflictException(
          'Đề tài đã bị khoá. Mở khoá trước khi gán sinh viên.',
        );
      }

      const students = await tx.student.findMany({
        where: { id: { in: dto.studentIds }, deleted_at: null },
        select: {
          id: true,
          student_id: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          class_name: true,
          project: { select: { id: true, status: true, topic_id: true } },
        },
      });
      if (students.length !== dto.studentIds.length) {
        const found = new Set(students.map((student) => student.id));
        const missing = dto.studentIds.filter((id) => !found.has(id));
        throw new NotFoundException(
          `Không tìm thấy sinh viên: ${missing.join(', ')}`,
        );
      }

      const banRows = await tx.student_progress.findMany({
        where: { student_id: { in: dto.studentIds }, is_banned: true },
        select: { student_id: true },
      });
      if (banRows.length) {
        const bannedIds = new Set(banRows.map((row) => row.student_id));
        const banned = students.find((student) => bannedIds.has(student.id));
        throw new ForbiddenException(
          `Sinh viên ${banned?.student_id ?? bannedIds.values().next().value} đang bị cấm làm đồ án.`,
        );
      }

      const occupied = students.find(
        (student) =>
          student.project &&
          SLOT_OCCUPYING_PROJECT_STATUSES.includes(student.project.status),
      );
      if (occupied) {
        throw new ConflictException(
          `Sinh viên ${occupied.student_id} đã có đề tài ở trạng thái ${
            PROJECT_STATUS_LABELS[occupied.project.status]
          }.`,
        );
      }

      await this.assertCapacity(tx, topic, students.length);

      const assigned = await this.assignStudents(
        tx,
        topic,
        students,
        actorUserId,
        dto.reason,
        ProjectStatus.ASSIGNED,
      );

      const registeredStudents = await this.recomputeRegisteredStudents(
        tx,
        topic.id,
      );

      await tx.topic_audits.create({
        data: {
          topic_id: topic.id,
          action: TopicAuditAction.MANUAL_ASSIGN,
          before_data: {
            registered_students: topic.registered_students,
          } as Prisma.InputJsonValue,
          after_data: {
            registered_students: registeredStudents,
            assignedProjectIds: assigned.map((project) => project.id),
            assignedStudentIds: students.map((student) => student.id),
          } as Prisma.InputJsonValue,
          reason: dto.reason,
          actor_user_id: actorUserId,
        },
      });

      return {
        topicId: topic.id,
        assigned: assigned.map((project) => ({
          projectId: project.id,
          projectCode: project.project_id,
          studentId: project.student_id,
          status: project.status,
        })),
        registeredStudents,
      };
    });
  }

  async forceUpdate(
    topicId: number,
    dto: ForceUpdateTopicDto,
    actorUserId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.topics.findUnique({
        where: { id: topicId },
        include: {
          registration_periods: { select: { id: true, school_year: true } },
          teachers: { select: { id: true, department_id: true } },
          projects: {
            where: { deleted_at: null },
            select: { id: true, status: true, student_id: true },
          },
        },
      });
      if (!topic) {
        throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
      }

      const before = {
        name: topic.name,
        description: topic.description,
        max_students: topic.max_students,
        teacher_id: topic.teacher_id,
        status: topic.status,
        locked_at: topic.locked_at?.toISOString() ?? null,
        moderator_note: topic.moderator_note,
        rejection_reason: topic.rejection_reason,
      };

      const data: Prisma.topicsUpdateInput = { updated_at: new Date() };

      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;

      if (dto.maxStudents !== undefined) {
        await this.deadlinePolicy.assertMaxStudentsAllowed(
          topic.period_id,
          dto.maxStudents,
        );
        const occupied = topic.projects.filter((project) =>
          SLOT_OCCUPYING_PROJECT_STATUSES.includes(project.status),
        ).length;
        if (dto.maxStudents < occupied) {
          throw new BadRequestException(
            `Không thể giảm sĩ số tối đa xuống ${dto.maxStudents} vì đề tài đang có ${occupied} sinh viên.`,
          );
        }
        data.max_students = dto.maxStudents;
      }

      if (dto.teacherId !== undefined && dto.teacherId !== topic.teacher_id) {
        const teacher = await tx.teacher.findFirst({
          where: { id: dto.teacherId, deleted_at: null },
          select: { id: true, name: true },
        });
        if (!teacher) {
          throw new NotFoundException(
            `Không tìm thấy giảng viên có id ${dto.teacherId}`,
          );
        }

        const occupied = topic.projects.filter(
          (project) => project.status !== ProjectStatus.REJECTED,
        ).length;
        if (occupied > 0) {
          throw new BadRequestException(
            'Không thể đổi GVHD khi đề tài đã có sinh viên. Hãy huỷ đăng ký trước.',
          );
        }

        // Force-edit được phép sau hạn tạo đề tài. Khi đổi GVHD chỉ kiểm
        // chỉ tiêu của giảng viên mới, không kiểm lại TOPIC_CREATION.
        const quota = await this.deadlinePolicy.getEffectiveQuota(
          topic.period_id,
          dto.teacherId,
        );
        if (quota.remainingTopics <= 0) {
          throw new ForbiddenException(
            `Giảng viên ${teacher.name} đã sử dụng hết chỉ tiêu ${quota.assignedQuota} đề tài trong đợt này.`,
          );
        }
        data.teachers = { connect: { id: dto.teacherId } };
      }

      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === TopicStatus.REJECTED) {
          data.rejection_reason = dto.reason;
        } else {
          data.rejection_reason = null;
        }
        if (dto.status !== TopicStatus.PENDING) {
          data.moderator_note = dto.reason;
        }
      }

      if (dto.locked !== undefined) {
        data.locked_at = dto.locked ? new Date() : null;
      }

      const updated = await tx.topics.update({
        where: { id: topicId },
        data,
        select: {
          name: true,
          description: true,
          max_students: true,
          teacher_id: true,
          status: true,
          locked_at: true,
          moderator_note: true,
          rejection_reason: true,
        },
      });

      const registeredStudents = await this.recomputeRegisteredStudents(
        tx,
        topicId,
      );

      const after = {
        ...updated,
        locked_at: updated.locked_at?.toISOString() ?? null,
        registered_students: registeredStudents,
      };

      await tx.topic_audits.create({
        data: {
          topic_id: topicId,
          action: TopicAuditAction.FORCE_UPDATE,
          before_data: before as Prisma.InputJsonValue,
          after_data: after as Prisma.InputJsonValue,
          reason: dto.reason,
          actor_user_id: actorUserId,
        },
      });

      // Đổi GVHD ảnh hưởng chỉ tiêu của cả hai giảng viên.
      await this.syncTeacherQuotaCounter(tx, topic.period_id, updated.teacher_id);
      if (topic.teacher_id !== updated.teacher_id) {
        await this.syncTeacherQuotaCounter(tx, topic.period_id, topic.teacher_id);
      }

      // Tải lại đúng bộ quan hệ mà mapManagedRow() cần — counter đã recompute
      // xong, nên response phản ánh sĩ số và danh sách SV sau force-edit.
      const managedTopic = await tx.topics.findUnique({
        where: { id: topicId },
        include: MANAGE_INCLUDE,
      });
      if (!managedTopic) {
        throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
      }

      return this.mapManagedRow(managedTopic);
    });
  }

  async bulkModeration(dto: BulkModerationDto, actorUserId: number) {
    if (dto.action === 'REJECT' && !dto.reason?.trim()) {
      throw new BadRequestException(
        'Từ chối đề tài bắt buộc phải nêu lý do.',
      );
    }

    const status =
      dto.action === 'APPROVE' ? TopicStatus.APPROVED : TopicStatus.REJECTED;
    const action =
      dto.action === 'APPROVE'
        ? TopicAuditAction.BULK_APPROVE
        : TopicAuditAction.BULK_REJECT;

    return this.prisma.$transaction(async (tx) => {
      const topics = await tx.topics.findMany({
        where: { id: { in: dto.topicIds } },
        select: {
          id: true,
          name: true,
          status: true,
          moderator_note: true,
          rejection_reason: true,
          max_students: true,
          teacher_id: true,
          registered_students: true,
        },
      });

      const foundIds = new Set(topics.map((topic) => topic.id));
      const notFound = dto.topicIds.filter((id) => !foundIds.has(id));

      for (const topic of topics) {
        await tx.topics.update({
          where: { id: topic.id },
          data: {
            status,
            moderator_note: dto.reason ?? topic.moderator_note,
            rejection_reason:
              status === TopicStatus.REJECTED ? dto.reason : null,
            updated_at: new Date(),
          },
        });

        await tx.topic_audits.create({
          data: {
            topic_id: topic.id,
            action,
            before_data: {
              status: topic.status,
              moderator_note: topic.moderator_note,
              rejection_reason: topic.rejection_reason,
            } as Prisma.InputJsonValue,
            after_data: {
              status,
              moderator_note: dto.reason ?? topic.moderator_note,
              rejection_reason:
                status === TopicStatus.REJECTED ? dto.reason : null,
            } as Prisma.InputJsonValue,
            reason:
              dto.reason?.trim() ||
              (status === TopicStatus.APPROVED
                ? 'Duyệt hàng loạt bởi quản trị.'
                : 'Từ chối hàng loạt bởi quản trị.'),
            actor_user_id: actorUserId,
          },
        });
      }

      // Đồng bộ trạng thái đăng ký: đề tài bị từ chối thì các đăng ký đang
      // chờ không còn giá trị duyệt.
      if (status === TopicStatus.REJECTED && topics.length) {
        await tx.project.updateMany({
          where: {
            topic_id: { in: topics.map((topic) => topic.id) },
            deleted_at: null,
            status: ProjectStatus.PENDING,
          },
          data: {
            status: ProjectStatus.REJECTED,
            moderator_note: dto.reason ?? 'Đề tài bị từ chối.',
          },
        });
      }

      const affectedTeacherIds = [
        ...new Set(topics.map((topic) => topic.teacher_id)),
      ];
      const periodIds = await tx.topics.findMany({
        where: { id: { in: topics.map((topic) => topic.id) } },
        select: { period_id: true },
      });
      for (const teacherId of affectedTeacherIds) {
        for (const periodId of new Set(periodIds.map((p) => p.period_id))) {
          await this.syncTeacherQuotaCounter(tx, periodId, teacherId);
        }
      }

      return {
        action: dto.action,
        approved: status === TopicStatus.APPROVED ? topics.length : 0,
        rejected: status === TopicStatus.REJECTED ? topics.length : 0,
        updated: topics.length,
        notFound,
      };
    });
  }

  async createSupplemental(dto: CreateSupplementalTopicDto, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id: dto.teacherId, deleted_at: null },
        select: { id: true, name: true, department_id: true },
      });
      if (!teacher) {
        throw new NotFoundException(
          `Không tìm thấy giảng viên có id ${dto.teacherId}`,
        );
      }

      const period = await tx.registration_periods.findUnique({
        where: { id: dto.periodId },
        select: { id: true, school_year: true },
      });
      if (!period) {
        throw new NotFoundException(
          `Không tìm thấy đợt đồ án có id ${dto.periodId}`,
        );
      }

      await this.deadlinePolicy.assertMaxStudentsAllowed(
        dto.periodId,
        dto.maxStudents,
      );

      // Đề tài bổ sung được tạo sau deadline → không kiểm TOPIC_CREATION,
      // nhưng chỉ tiêu của GV vẫn là ràng buộc cứng.
      const quota = await this.deadlinePolicy.getEffectiveQuota(
        dto.periodId,
        dto.teacherId,
      );
      if (quota.remainingTopics <= 0) {
        throw new ForbiddenException(
          `Giảng viên ${teacher.name} đã sử dụng hết chỉ tiêu ${quota.assignedQuota} đề tài trong đợt này.`,
        );
      }

      const students = dto.studentIds?.length
        ? await tx.student.findMany({
            where: { id: { in: dto.studentIds }, deleted_at: null },
            select: {
              id: true,
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              project: { select: { id: true, status: true } },
            },
          })
        : [];

      if (students.length !== (dto.studentIds?.length ?? 0)) {
        const found = new Set(students.map((student) => student.id));
        const missing = (dto.studentIds ?? []).filter((id) => !found.has(id));
        throw new NotFoundException(
          `Không tìm thấy sinh viên: ${missing.join(', ')}`,
        );
      }
      if (students.length > dto.maxStudents) {
        throw new BadRequestException(
          `Số sinh viên gán (${students.length}) vượt sĩ số tối đa của đề tài (${dto.maxStudents}).`,
        );
      }

      const occupied = students.find(
        (student) =>
          student.project &&
          SLOT_OCCUPYING_PROJECT_STATUSES.includes(student.project.status),
      );
      if (occupied) {
        throw new ConflictException(
          `Sinh viên ${occupied.student_id} đã có đề tài.`,
        );
      }

      if (students.length) {
        const bannedRows = await tx.student_progress.findMany({
          where: {
            student_id: { in: students.map((student) => student.id) },
            is_banned: true,
          },
          select: { student_id: true },
        });
        if (bannedRows.length) {
          const bannedIds = new Set(bannedRows.map((row) => row.student_id));
          const banned = students.find((student) => bannedIds.has(student.id));
          throw new ForbiddenException(
            `Sinh viên ${banned?.student_id ?? bannedIds.values().next().value} đang bị cấm làm đồ án.`,
          );
        }
      }

      const deptCode = resolveDepartmentCode(teacher.department_id);
      const code = await this.allocateTopicCode(
        tx,
        period.id,
        period.school_year,
        deptCode,
      );

      const now = new Date();
      const topic = await tx.topics.create({
        data: {
          period_id: dto.periodId,
          teacher_id: dto.teacherId,
          code,
          name: dto.name,
          description: dto.description,
          max_students: dto.maxStudents,
          registered_students: 0,
          status: TopicStatus.APPROVED,
          is_supplemental: true,
          supplemental_reason: dto.reason,
          moderator_note: dto.reason,
          created_at: now,
          updated_at: now,
        },
      });

      const assigned = students.length
        ? await this.assignStudents(
            tx,
            topic,
            students,
            actorUserId,
            dto.reason,
            ProjectStatus.ASSIGNED,
          )
        : [];

      const registeredStudents = await this.recomputeRegisteredStudents(
        tx,
        topic.id,
      );

      await tx.topic_audits.create({
        data: {
          topic_id: topic.id,
          action: TopicAuditAction.SUPPLEMENTAL_CREATE,
          before_data: null,
          after_data: {
            code: topic.code,
            name: topic.name,
            teacher_id: topic.teacher_id,
            max_students: topic.max_students,
            assignedStudentIds: students.map((student) => student.id),
            assignedProjectIds: assigned.map((project) => project.id),
            registered_students: registeredStudents,
          } as Prisma.InputJsonValue,
          reason: dto.reason,
          actor_user_id: actorUserId,
        },
      });

      await this.syncTeacherQuotaCounter(tx, dto.periodId, dto.teacherId);

      return {
        id: topic.id,
        code: topic.code,
        name: topic.name,
        status: topic.status,
        maxStudents: topic.max_students,
        registeredStudents,
        remainingQuota: Math.max(0, quota.remainingTopics - 1),
        assigned: assigned.map((project) => ({
          projectId: project.id,
          studentId: project.student_id,
          status: project.status,
        })),
      };
    });
  }

  async generateCodes(dto: GenerateTopicCodesDto, actorUserId: number) {
    const period = await this.prisma.registration_periods.findUnique({
      where: { id: dto.periodId },
      select: { id: true, school_year: true },
    });
    if (!period) {
      throw new NotFoundException(
        `Không tìm thấy đợt đồ án có id ${dto.periodId}`,
      );
    }

    const topics = await this.prisma.topics.findMany({
      where: {
        period_id: dto.periodId,
        ...(dto.topicIds?.length ? { id: { in: dto.topicIds } } : {}),
        ...(dto.overwrite ? {} : { code: null }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        teachers: { select: { id: true, department_id: true } },
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });

    const generated: Array<{ topicId: number; code: string; previous: string | null }> = [];
    const skipped: number[] = [];
    // Gom theo (deptCode) để mỗi lần cấp mã mở một transaction ngắn;
    // sequence tăng atomic nên hai request song song không trùng mã.
    const forcedDeptCode = dto.departmentCode?.trim() || null;

    for (const topic of topics) {
      if (!dto.overwrite && topic.code) {
        skipped.push(topic.id);
        continue;
      }
      const deptCode =
        forcedDeptCode ?? resolveDepartmentCode(topic.teachers?.department_id);

      try {
        const code = await this.prisma.$transaction(async (tx) => {
          const allocated = await this.allocateTopicCode(
            tx,
            period.id,
            period.school_year,
            deptCode,
          );
          await tx.topics.update({
            where: { id: topic.id },
            data: { code: allocated, updated_at: new Date() },
          });
          await tx.topic_audits.create({
            data: {
              topic_id: topic.id,
              action: TopicAuditAction.CODE_GENERATE,
              before_data: { code: topic.code } as Prisma.InputJsonValue,
              after_data: { code: allocated } as Prisma.InputJsonValue,
              reason: dto.overwrite
                ? `Sinh lại mã đề tài hàng loạt (đợt ${period.id}).`
                : `Sinh mã đề tài hàng loạt (đợt ${period.id}).`,
              actor_user_id: actorUserId,
            },
          });
          return allocated;
        });

        generated.push({ topicId: topic.id, code, previous: topic.code });
      } catch (error) {
        this.logger.error(
          `Không sinh được mã cho đề tài ${topic.id}`,
          error instanceof Error ? error.stack : undefined,
        );
        skipped.push(topic.id);
      }
    }

    return {
      periodId: period.id,
      generated: generated.length,
      skipped: skipped.length,
      skippedTopicIds: skipped,
      samples: generated.slice(0, 50),
      items: generated,
    };
  }

  async listAudits(topicId: number) {
    const topic = await this.prisma.topics.findUnique({
      where: { id: topicId },
      select: { id: true, name: true, code: true },
    });
    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }

    const audits = await this.prisma.topic_audits.findMany({
      where: { topic_id: topicId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: { id: true, username: true, email: true } },
      },
    });

    return {
      topic,
      items: audits.map((audit) => ({
        id: audit.id,
        action: audit.action,
        reason: audit.reason,
        before: audit.before_data,
        after: audit.after_data,
        actor: audit.actor
          ? {
              id: audit.actor.id,
              username: audit.actor.username,
              email: audit.actor.email,
            }
          : null,
        createdAt: audit.created_at.toISOString(),
      })),
      total: audits.length,
    };
  }

  // ==========================================================
  // Giảng viên
  // ==========================================================

  async createTopic(dto: CreateTopicDto, actorUserId: number) {
    const teacher = await this.resolveTeacherByUserId(actorUserId);

    // Deadline + quota + sĩ số tối đa đều do policy quyết định.
    const quota = await this.deadlinePolicy.assertTopicWritable(
      dto.periodId,
      teacher.id,
      { checkQuota: true, maxStudents: dto.maxStudents },
    );

    return this.prisma.$transaction(async (tx) => {
      const period = await tx.registration_periods.findUnique({
        where: { id: dto.periodId },
        select: { id: true, school_year: true },
      });
      if (!period) {
        throw new NotFoundException(
          `Không tìm thấy đợt đồ án có id ${dto.periodId}`,
        );
      }

      // Mã cấp ngay khi tạo để mã ổn định và không phải sinh lại hàng loạt.
      const deptCode = resolveDepartmentCode(teacher.department_id);
      const code = await this.allocateTopicCode(
        tx,
        period.id,
        period.school_year,
        deptCode,
      );

      const now = new Date();
      const topic = await tx.topics.create({
        data: {
          period_id: dto.periodId,
          teacher_id: teacher.id,
          code,
          name: dto.name,
          description: dto.description,
          max_students: dto.maxStudents,
          registered_students: 0,
          status: TopicStatus.PENDING,
          is_supplemental: false,
          created_at: now,
          updated_at: now,
        },
        include: {
          registration_periods: { select: { id: true, name: true } },
        },
      });

      await tx.topic_audits.create({
        data: {
          topic_id: topic.id,
          action: TopicAuditAction.CREATE,
          before_data: null,
          after_data: {
            code: topic.code,
            name: topic.name,
            max_students: topic.max_students,
          } as Prisma.InputJsonValue,
          reason: 'Giảng viên tạo đề tài mới.',
          actor_user_id: actorUserId,
        },
      });

      await this.syncTeacherQuotaCounter(tx, dto.periodId, teacher.id);

      return {
        ...this.mapTeacherTopic(topic as unknown as ManagedTopic, []),
        quota: {
          assignedQuota: quota.assignedQuota,
          usedTopics: quota.usedTopics + 1,
          remainingTopics: Math.max(0, quota.remainingTopics - 1),
          maxStudentsPerTopic: quota.maxStudentsPerTopic,
        },
      };
    });
  }

  async updateTopic(
    topicId: number,
    dto: UpdateTopicDto,
    actorUserId: number,
  ) {
    const teacher = await this.resolveTeacherByUserId(actorUserId);

    const topic = await this.prisma.topics.findUnique({
      where: { id: topicId },
      include: {
        registration_periods: { select: { id: true, name: true } },
        projects: {
          where: { deleted_at: null },
          select: { id: true, status: true },
        },
      },
    });
    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }
    if (topic.teacher_id !== teacher.id) {
      throw new ForbiddenException(
        'Bạn không có quyền sửa đề tài của giảng viên khác.',
      );
    }
    if (topic.locked_at) {
      throw new ForbiddenException(
        'Đề tài đã bị khoá. Vui lòng liên hệ Thư ký để được hỗ trợ.',
      );
    }

    // Sửa đề tài không tiêu tốn quota mới nên checkQuota=false, nhưng deadline
    // tạo/sửa đề tài vẫn phải còn mở.
    const periodId = dto.periodId ?? topic.period_id;
    await this.deadlinePolicy.assertTopicWritable(periodId, teacher.id, {
      checkQuota: false,
      maxStudents: dto.maxStudents,
    });

    if (topic.status === TopicStatus.APPROVED) {
      const occupied = topic.projects.filter((project) =>
        SLOT_OCCUPYING_PROJECT_STATUSES.includes(project.status),
      ).length;
      if (
        (dto.name !== undefined && dto.name !== topic.name) ||
        (dto.description !== undefined && dto.description !== topic.description)
      ) {
        if (occupied > 0) {
          throw new ConflictException(
            'Đề tài đã được duyệt và có sinh viên đăng ký. Yêu cầu Thư ký chỉnh sửa giúp bạn.',
          );
        }
      }
      if (
        dto.maxStudents !== undefined &&
        dto.maxStudents < occupied
      ) {
        throw new BadRequestException(
          `Không thể giảm sĩ số tối đa xuống ${dto.maxStudents} vì đề tài đang có ${occupied} sinh viên.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = {
        name: topic.name,
        description: topic.description,
        max_students: topic.max_students,
        period_id: topic.period_id,
      };

      const data: Prisma.topicsUpdateInput = { updated_at: new Date() };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.maxStudents !== undefined) data.max_students = dto.maxStudents;
      if (dto.periodId !== undefined && dto.periodId !== topic.period_id) {
        data.registration_periods = { connect: { id: dto.periodId } };
      }
      // Đề tài đã duyệt mà GV sửa nội dung → quay lại chờ duyệt.
      if (
        topic.status === TopicStatus.APPROVED &&
        (dto.name !== undefined || dto.description !== undefined)
      ) {
        data.status = TopicStatus.PENDING;
      }

      const updated = await tx.topics.update({
        where: { id: topicId },
        data,
        include: {
          registration_periods: { select: { id: true, name: true } },
        },
      });

      await tx.topic_audits.create({
        data: {
          topic_id: topicId,
          action: TopicAuditAction.UPDATE,
          before_data: before as Prisma.InputJsonValue,
          after_data: {
            name: updated.name,
            description: updated.description,
            max_students: updated.max_students,
            period_id: updated.period_id,
            status: updated.status,
          } as Prisma.InputJsonValue,
          reason: 'Giảng viên cập nhật đề tài.',
          actor_user_id: actorUserId,
        },
      });

      await this.syncTeacherQuotaCounter(tx, updated.period_id, teacher.id);

      return this.mapTeacherTopic(updated as unknown as ManagedTopic, topic.projects);
    });
  }

  async listMyTopics(actorUserId: number, periodId?: number) {
    const teacher = await this.resolveTeacherByUserId(actorUserId);
    const resolvedPeriodId = periodId ?? (await this.resolveActivePeriodId());

    const [topics, quota, governance] = await Promise.all([
      this.prisma.topics.findMany({
        where: { teacher_id: teacher.id, period_id: resolvedPeriodId },
        include: MANAGE_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      }),
      this.deadlinePolicy.getEffectiveQuota(resolvedPeriodId, teacher.id),
      this.deadlinePolicy.getGovernanceView(resolvedPeriodId),
    ]);

    const pendingCount = topics.reduce(
      (sum, topic) =>
        sum +
        topic.projects.filter(
          (project) => project.status === ProjectStatus.PENDING,
        ).length,
      0,
    );

    return {
      periodId: resolvedPeriodId,
      quota,
      governance,
      pendingApprovals: pendingCount,
      items: topics.map((topic) => this.mapTeacherTopic(topic, topic.projects)),
      total: topics.length,
    };
  }

  /**
   * Khóa đề tài kèm phân công nhiệm vụ cho từng thành viên.
   * Được gọi bởi Giảng viên khi:
   *   (a) Chủ động bấm nút "Khóa đề tài" (dù chưa full slot), hoặc
   *   (b) Vừa duyệt sinh viên cuối cùng làm đầy slot và FE phát hiện slot FULL.
   *
   * Validate:
   *   - Đề tài thuộc Giảng viên đang đăng nhập.
   *   - Chưa bị khóa trước đó.
   *   - assignments phải cover đúng tất cả SV trạng thái APPROVED của đề tài.
   *   - Có đúng 1 is_leader = true.
   */
  async lockTopicWithAssignments(
    topicId: number,
    dto: { assignments: Array<{ projectId: number; assignedTask: string; isLeader: boolean }> },
    actorUserId: number,
  ) {
    const teacher = await this.resolveTeacherByUserId(actorUserId);

    const topic = await this.prisma.topics.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        teacher_id: true,
        period_id: true,
        status: true,
        max_students: true,
        locked_at: true,
      },
    });

    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }
    if (topic.teacher_id !== teacher.id) {
      throw new ForbiddenException('Bạn không có quyền khóa đề tài của giảng viên khác.');
    }
    if (topic.locked_at) {
      throw new ConflictException('Đề tài đã bị khóa trước đó.');
    }

    // Validate có đúng 1 trưởng nhóm
    const leaderCount = dto.assignments.filter((a) => a.isLeader).length;
    if (leaderCount !== 1) {
      throw new BadRequestException(
        `Phải chỉ định đúng 1 trưởng nhóm. Hiện tại đang chọn: ${leaderCount}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Lấy tất cả Project APPROVED thuộc đề tài này
      const approvedProjects = await tx.project.findMany({
        where: {
          topic_id: topicId,
          status: ProjectStatus.APPROVED,
          deleted_at: null,
        },
        select: { id: true },
      });

      const approvedIds = new Set(approvedProjects.map((p) => p.id));
      const assignmentIds = new Set(dto.assignments.map((a) => a.projectId));

      // Kiểm tra assignments phải cover đủ & khớp đúng danh sách SV APPROVED
      for (const id of approvedIds) {
        if (!assignmentIds.has(id)) {
          throw new BadRequestException(
            `Sinh viên với Project ID ${id} (đã duyệt) chưa được phân công nhiệm vụ.`,
          );
        }
      }
      for (const id of assignmentIds) {
        if (!approvedIds.has(id)) {
          throw new BadRequestException(
            `Project ID ${id} không thuộc danh sách sinh viên đã duyệt của đề tài này.`,
          );
        }
      }

      // Cập nhật is_leader & assigned_task cho từng Project
      await Promise.all(
        dto.assignments.map((a) =>
          tx.project.update({
            where: { id: a.projectId },
            data: {
              is_leader: a.isLeader,
              assigned_task: a.assignedTask,
            },
          }),
        ),
      );

      // Khóa đề tài
      const now = new Date();
      await tx.topics.update({
        where: { id: topicId },
        data: { locked_at: now, updated_at: now },
      });

      await tx.topic_audits.create({
        data: {
          topic_id: topicId,
          action: TopicAuditAction.FORCE_UPDATE,
          before_data: { locked_at: null } as Prisma.InputJsonValue,
          after_data: {
            locked_at: now.toISOString(),
            assignedLeaderProjectId: dto.assignments.find((a) => a.isLeader)?.projectId,
          } as Prisma.InputJsonValue,
          reason: 'Giảng viên khóa đề tài và phân công nhiệm vụ nhóm.',
          actor_user_id: actorUserId,
        },
      });

      return {
        topicId,
        lockedAt: now.toISOString(),
        assignmentsApplied: dto.assignments.length,
        leaderId: dto.assignments.find((a) => a.isLeader)?.projectId,
      };
    });
  }

  async decideRegistration(
    topicId: number,
    projectId: number,
    dto: RegistrationDecisionDto,
    actorUserId: number,
  ) {
    const teacher = await this.resolveTeacherByUserId(actorUserId);

    const [topic, project] = await Promise.all([
      this.prisma.topics.findUnique({
        where: { id: topicId },
        select: {
          id: true,
          teacher_id: true,
          period_id: true,
          status: true,
          max_students: true,
          locked_at: true,
        },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          topic_id: true,
          teacher_id: true,
          student_id: true,
          status: true,
        },
      }),
    ]);

    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }
    if (!project) {
      throw new NotFoundException(
        `Không tìm thấy đăng ký có id ${projectId}`,
      );
    }
    if (project.topic_id !== topicId) {
      throw new BadRequestException('Đăng ký không thuộc đề tài này.');
    }
    if (topic.teacher_id !== teacher.id || project.teacher_id !== teacher.id) {
      throw new ForbiddenException(
        'Bạn không có quyền duyệt đăng ký của đề tài này.',
      );
    }
    if (
      project.status !== ProjectStatus.PENDING &&
      project.status !== ProjectStatus.WAITING_SECRETARY
    ) {
      throw new ConflictException(
        `Đăng ký đã ở trạng thái ${PROJECT_STATUS_LABELS[project.status]}.`,
      );
    }

    // Sau hạn duyệt, GV không được quyết định nữa — Thư ký/Admin xử lý.
    await this.deadlinePolicy.assertApprovalOpen(topic.period_id);

    const approve = dto.decision === 'APPROVE';
    if (approve) {
      await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.topics.findUnique({
          where: { id: topicId },
          select: { id: true, max_students: true },
        });
        await this.assertCapacity(tx, fresh, 1, project.id);

        await tx.project.update({
          where: { id: projectId },
          data: {
            status: ProjectStatus.APPROVED,
            moderator_note: dto.note ?? null,
            decided_by_user_id: actorUserId,
            teacher_decided_at: new Date(),
          },
        });
        await this.recomputeRegisteredStudents(tx, topicId);
        await tx.topic_audits.create({
          data: {
            topic_id: topicId,
            action: TopicAuditAction.REGISTRATION_APPROVE,
            before_data: { project_status: project.status } as Prisma.InputJsonValue,
            after_data: {
              project_status: ProjectStatus.APPROVED,
              project_id: projectId,
            } as Prisma.InputJsonValue,
            reason: dto.note?.trim() || 'Giảng viên duyệt đăng ký.',
            actor_user_id: actorUserId,
          },
        });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: projectId },
          data: {
            status: ProjectStatus.REJECTED,
            moderator_note: dto.note ?? null,
            decided_by_user_id: actorUserId,
            teacher_decided_at: new Date(),
          },
        });
        await this.recomputeRegisteredStudents(tx, topicId);
        await tx.topic_audits.create({
          data: {
            topic_id: topicId,
            action: TopicAuditAction.REGISTRATION_REJECT,
            before_data: { project_status: project.status } as Prisma.InputJsonValue,
            after_data: {
              project_status: ProjectStatus.REJECTED,
              project_id: projectId,
            } as Prisma.InputJsonValue,
            reason: dto.note?.trim() || 'Giảng viên từ chối đăng ký.',
            actor_user_id: actorUserId,
          },
        });
      });
    }

    const updated = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { student: { select: { id: true, student_id: true } } },
    });

    // Sau khi APPROVE: kiểm tra slot đầy → báo FE bật popup phân công
    let requiresAssignment = false;
    if (dto.decision === 'APPROVE') {
      const freshTopic = await this.prisma.topics.findUnique({
        where: { id: topicId },
        select: { registered_students: true, max_students: true, locked_at: true },
      });
      if (freshTopic && !freshTopic.locked_at) {
        requiresAssignment = freshTopic.registered_students >= freshTopic.max_students;
      }
    }

    return {
      projectId,
      topicId,
      decision: dto.decision,
      status: updated.status,
      statusLabel: PROJECT_STATUS_LABELS[updated.status],
      studentCode: updated.student?.student_id ?? null,
      decidedAt: updated.teacher_decided_at?.toISOString() ?? null,
      /** true khi vừa duyệt SV cuối làm đầy slot → FE bật popup phân công */
      requiresAssignment,
    };
  }


  // ==========================================================
  // Sinh viên
  // ==========================================================

  async listAvailableTopics(query: TopicAvailableQueryDto, actorUserId?: number) {
    const periodId = query.periodId ?? (await this.resolveActivePeriodId());
    const search = query.search?.trim();
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.topicsWhereInput = {
      period_id: periodId,
      status: TopicStatus.APPROVED,
      locked_at: null,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { teachers: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [topics, total, governance, myRegistration] = await Promise.all([
      this.prisma.topics.findMany({
        where,
        include: MANAGE_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.topics.count({ where }),
      this.deadlinePolicy.getGovernanceView(periodId),
      actorUserId
        ? this.findStudentRegistration(actorUserId)
        : Promise.resolve(null),
    ]);

    return {
      ...paginate(
        topics
          .map((topic) => {
            const row = this.mapManagedRow(topic);
            const mine =
              myRegistration && myRegistration.topic_id === topic.id
                ? {
                    projectId: myRegistration.id,
                    status: myRegistration.status,
                    statusLabel: PROJECT_STATUS_LABELS[myRegistration.status],
                  }
                : null;
            return {
              id: row.id,
              code: row.code,
              name: row.name,
              description: row.description,
              maxStudents: row.maxStudents,
              registeredCount: row.students.filter((student) =>
                SLOT_OCCUPYING_PROJECT_STATUSES.includes(
                  student.status as ProjectStatus,
                ),
              ).length,
              remainingSlots: row.remainingSlots,
              status: row.status,
              statusLabel: row.statusLabel,
              registrationStatus:
                row.remainingSlots <= 0 ? 'FULL' : 'OPEN',
              teacherName: row.teacher?.name ?? null,
              teacherEmail: row.teacher?.email ?? null,
              department: row.teacher?.departmentName ?? null,
              faculty: row.teacher?.facultyName ?? null,
              students: row.students.map((student) => ({
                studentCode: student.studentCode,
                studentName: student.name,
                status: student.status,
                statusLabel: student.statusLabel,
                registeredAt: student.registeredAt,
              })),
              myRegistration: mine,
              createdAt: row.createdAt,
            };
          })
          // Lưới an toàn: counter có thể lệch với dữ liệu thật.
          .filter(
            (topic) => topic.registeredCount < topic.maxStudents,
          ),
        total,
        page,
        limit,
      ),
      periodId,
      governance,
      myRegistration: myRegistration
        ? {
            projectId: myRegistration.id,
            topicId: myRegistration.topic_id,
            status: myRegistration.status,
            statusLabel: PROJECT_STATUS_LABELS[myRegistration.status],
          }
        : null,
    };
  }

  async registerTopic(topicId: number, actorUserId: number) {
    const student = await this.resolveStudentByUserId(actorUserId);

    const topic = await this.prisma.topics.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        code: true,
        period_id: true,
        teacher_id: true,
        name: true,
        description: true,
        max_students: true,
        status: true,
        locked_at: true,
      },
    });
    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }
    if (topic.status !== TopicStatus.APPROVED) {
      throw new BadRequestException(
        'Đề tài chưa được duyệt nên chưa thể đăng ký.',
      );
    }
    if (topic.locked_at) {
      throw new ConflictException('Đề tài đã chốt danh sách sinh viên.');
    }

    // Hạn đăng ký do policy quyết định; deadline_id được lưu vào Project.
    const deadline = await this.deadlinePolicy.assertRegistrationOpen(
      topic.period_id,
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({
        where: { student_id: student.id },
        select: {
          id: true,
          status: true,
          topic_id: true,
          deleted_at: true,
        },
      });

      if (existing && existing.deleted_at === null) {
        if (SLOT_OCCUPYING_PROJECT_STATUSES.includes(existing.status)) {
          throw new ConflictException(
            existing.topic_id === topicId
              ? 'Bạn đã đăng ký đề tài này rồi.'
              : `Bạn đã có đăng ký ở trạng thái ${PROJECT_STATUS_LABELS[existing.status]}. Hãy huỷ hoặc chờ kết quả trước khi đăng ký đề tài khác.`,
          );
        }
      }

      await this.assertCapacity(tx, topic, 1, existing?.id);

      const now = new Date();
      
      // Tạo mã project thân thiện thay vì UUID
      // Ví dụ: DA-SE001-SV001 (Đồ án - Mã Đề tài - Mã SV)
      const newProjectId = `DA-${topic.code || topic.id}-${student.student_id}`;

      const projectData = {
        project_id: newProjectId,
        project_name: topic.name,
        description: topic.description,
        topic_id: topic.id,
        teacher_id: topic.teacher_id,
        status: ProjectStatus.PENDING,
        deadline_id: deadline?.id ?? null,
        assigned_by_user_id: null,
        assign_reason: null,
        decided_by_user_id: null,
        teacher_decided_at: null,
        moderator_note: null,
        deleted_at: null,
        updated_at: now,
      };

      // student_id @unique → sinh viên bị từ chối phải tái sử dụng dòng cũ.
      const project = existing
        ? await tx.project.update({
            where: { id: existing.id },
            data: projectData,
          })
        : await tx.project.create({
            data: {
              student_id: student.id,
              created_at: now,
              ...projectData,
            },
          });

      await this.recomputeRegisteredStudents(tx, topic.id);
      await this.ensureStudentProgress(tx, student.id, now);

      return {
        projectId: project.id,
        projectCode: project.project_id,
        topicId: topic.id,
        topicName: topic.name,
        status: project.status,
        statusLabel: PROJECT_STATUS_LABELS[project.status],
        message:
          'Đăng ký đã được gửi đến giảng viên hướng dẫn để phê duyệt.',
      };
    });
  }

  async getMyRegistration(actorUserId: number) {
    const student = await this.resolveStudentByUserId(actorUserId);
    const project = await this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
      include: {
        // Đề tài từ thư viện (sinh viên đăng ký bình thường)
        topics: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            max_students: true,
            rejection_reason: true,
            status: true,
            period_id: true,
            teachers: { select: { id: true, name: true, email: true } },
            registration_periods: { select: { id: true, name: true } },
          },
        },
        // Giảng viên gắn trực tiếp với project (dùng khi topic_id = null)
        teacher: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!project) {
      return {
        student: { id: student.id, studentCode: student.student_id },
        registration: null,
      };
    }

    // Nếu project được tạo qua đăng ký thông thường → dùng topics
    // Nếu topic_id = null (seed data, tự đề xuất, gán tay) → fallback về project fields
    const topicInfo = project.topics
      ? {
          id: project.topics.id,
          code: project.topics.code,
          name: project.topics.name,
          description: project.topics.description,
          rejectionReason: project.topics.rejection_reason ?? null,
          maxStudents: project.topics.max_students,
          status: project.topics.status,
          statusLabel: TOPIC_STATUS_LABELS[project.topics.status],
          periodId: project.topics.period_id,
          periodName: project.topics.registration_periods?.name ?? null,
          teacherName: project.topics.teachers?.name ?? null,
          teacherEmail: project.topics.teachers?.email ?? null,
        }
      : {
          // Fallback: dùng thông tin gắn trực tiếp trên project
          id: null,
          code: project.project_id,      // UUID làm mã thay thế
          name: project.project_name,
          description: project.description,
          rejectionReason: null,
          maxStudents: 1,
          status: null,
          statusLabel: null,
          periodId: null,
          periodName: null,
          teacherName: project.teacher?.name ?? null,
          teacherEmail: project.teacher?.email ?? null,
        };

    return {
      student: { id: student.id, studentCode: student.student_id },
      registration: {
        projectId: project.id,
        projectCode: project.project_id,
        status: project.status,
        statusLabel: PROJECT_STATUS_LABELS[project.status],
        moderatorNote: project.moderator_note,
        registeredAt: project.created_at.toISOString(),
        decidedAt: project.teacher_decided_at?.toISOString() ?? null,
        topic: topicInfo,
      },
    };
  }

  // ==========================================================
  // Chi tiết đề tài
  // ==========================================================

  async findOne(topicId: number) {
    const topic = await this.prisma.topics.findUnique({
      where: { id: topicId },
      include: MANAGE_INCLUDE,
    });
    if (!topic) {
      throw new NotFoundException(`Không tìm thấy đề tài có id ${topicId}`);
    }
    return this.mapManagedRow(topic);
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private async resolveTeacherByUserId(userId: number) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: {
        id: true,
        user_id: true,
        teacher_id: true,
        name: true,
        email: true,
        department_id: true,
        faculty_id: true,
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
      select: {
        id: true,
        user_id: true,
        student_id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        class_name: true,
        email: true,
      },
    });
    if (!student) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ sinh viên.',
      );
    }
    return student;
  }

  private async findStudentRegistration(userId: number) {
    const student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!student) return null;

    return this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
      select: { id: true, topic_id: true, status: true },
    });
  }

  private async findBanRecords(studentIds: number[]) {
    if (!studentIds.length) return [];

    return this.prisma.student_progress.findMany({
      where: { student_id: { in: studentIds } },
      select: { student_id: true, is_banned: true, ban_reason: true },
    });
  }

  /** Đợt đang mở; nếu không có thì lấy đợt sắp diễn ra gần nhất. */
  private async resolveActivePeriodId(): Promise<number> {
    const period =
      (await this.prisma.registration_periods.findFirst({
        where: { status: 'OPEN' },
        orderBy: [{ start_date: 'desc' }],
        select: { id: true },
      })) ??
      (await this.prisma.registration_periods.findFirst({
        where: { status: 'UPCOMING' },
        orderBy: [{ start_date: 'asc' }],
        select: { id: true },
      })) ??
      (await this.prisma.registration_periods.findFirst({
        orderBy: [{ start_date: 'desc' }],
        select: { id: true },
      }));

    if (!period) {
      throw new NotFoundException(
        'Chưa có đợt đăng ký đồ án nào. Vui lòng tạo đợt trước.',
      );
    }
    return period.id;
  }

  private buildManageWhere(query: TopicManageQueryDto): Prisma.topicsWhereInput {
    const search = query.search?.trim();

    return {
      period_id: query.periodId,
      status: query.status,
      is_supplemental: query.isSupplemental,
      teacher_id: query.teacherId,
      ...(query.facultyId || query.departmentId
        ? {
            teachers: {
              ...(query.facultyId ? { faculty_id: query.facultyId } : {}),
              ...(query.departmentId
                ? { department_id: query.departmentId }
                : {}),
            },
          }
        : {}),
      ...(query.registrationStatus
        ? {
            projects: {
              some: {
                deleted_at: null,
                status: query.registrationStatus,
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                teachers: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { teacher_id: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
              {
                projects: {
                  some: {
                    deleted_at: null,
                    student: {
                      OR: [
                        { student_id: { contains: search, mode: 'insensitive' } },
                        { first_name: { contains: search, mode: 'insensitive' } },
                        { middle_name: { contains: search, mode: 'insensitive' } },
                        { last_name: { contains: search, mode: 'insensitive' } },
                        { class_name: { contains: search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy: TopicManageQueryDto['sortBy'],
    sortOrder: TopicManageQueryDto['sortOrder'],
  ): Prisma.topicsOrderByWithRelationInput[] {
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';
    switch (sortBy) {
      case 'code':
        return [{ code: direction }, { id: direction }];
      case 'name':
        return [{ name: direction }, { id: direction }];
      case 'teacher':
        return [{ teachers: { name: direction } }, { id: direction }];
      case 'status':
        return [{ status: direction }, { id: direction }];
      default:
        return [{ created_at: direction }, { id: direction }];
    }
  }

  /**
   * Kiểm tra còn slot cho `additional` sinh viên. `excludeProjectId` là dòng
   * Project sẽ được tái sử dụng (không chiếm slot mới).
   */
  private async assertCapacity(
    tx: Tx,
    topic: { id: number; max_students: number } | null,
    additional: number,
    excludeProjectId?: number,
  ): Promise<void> {
    if (!topic) {
      throw new NotFoundException('Không tìm thấy đề tài.');
    }

    const occupied = await tx.project.count({
      where: {
        topic_id: topic.id,
        deleted_at: null,
        status: { in: SLOT_OCCUPYING_PROJECT_STATUSES },
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
    });

    if (occupied + additional > topic.max_students) {
      throw new ConflictException(
        `Đề tài đã đạt sĩ số tối đa (${occupied}/${topic.max_students}). Không thể nhận thêm ${additional} sinh viên.`,
      );
    }
  }

  /**
   * Gán sinh viên vào đề tài. Tái sử dụng dòng Project bị REJECTED vì
   * `Project.student_id` là unique — không thể tạo dòng thứ hai.
   */
  private async assignStudents(
    tx: Tx,
    topic: { id: number; teacher_id: number; name: string; description: string; code?: string | null },
    students: Array<{
      id: number;
      student_id: string;
      project?: { id: number; status: ProjectStatus } | null;
    }>,
    actorUserId: number,
    reason: string,
    status: ProjectStatus,
  ) {
    const now = new Date();
    const results = [];

    for (const student of students) {
      const newProjectId = `DA-${topic.code || topic.id}-${student.student_id}`;
      
      const data = {
        project_id: newProjectId,
        project_name: topic.name,
        description: topic.description,
        topic_id: topic.id,
        teacher_id: topic.teacher_id,
        status,
        assigned_by_user_id: actorUserId,
        assign_reason: reason,
        decided_by_user_id: actorUserId,
        teacher_decided_at: now,
        moderator_note: reason,
        deleted_at: null,
        updated_at: now,
      };

      const project = student.project
        ? await tx.project.update({ where: { id: student.project.id }, data })
        : await tx.project.create({
            data: {
              student_id: student.id,
              deadline_id: null,
              created_at: now,
              ...data,
            },
          });

      await this.ensureStudentProgress(tx, student.id, now);
      results.push(project);
    }

    return results;
  }

  /**
   * `topics.registered_students` là counter suy biến: luôn tính lại từ số
   * Project thật trong cùng transaction để không lệch với danh sách SV.
   */
  private async recomputeRegisteredStudents(
    tx: Tx,
    topicId: number,
  ): Promise<number> {
    const counted = await tx.project.count({
      where: {
        topic_id: topicId,
        deleted_at: null,
        status: { in: COUNTED_PROJECT_STATUSES },
      },
    });

    await tx.topics.update({
      where: { id: topicId },
      data: { registered_students: counted, updated_at: new Date() },
    });

    return counted;
  }

  /**
   * Cấp mã `DT{year}_{DEPT}_{seq}`. Sequence tăng atomic bằng
   * INSERT ... ON CONFLICT nên hai request song song không nhận cùng một số.
   * Nếu mã đã tồn tại (dữ liệu legacy) thì cấp lại số kế tiếp.
   */
  private async allocateTopicCode(
    tx: Tx,
    periodId: number,
    schoolYear: string | null,
    departmentCode: string,
  ): Promise<string> {
    const year = resolveCodeYear(schoolYear);

    for (let attempt = 0; attempt < CODE_ALLOCATION_MAX_ATTEMPTS; attempt++) {
      const rows = await tx.$queryRaw<Array<{ next_seq: number }>>`
        INSERT INTO topic_code_sequences (period_id, dept_code, next_seq)
        VALUES (${periodId}, ${departmentCode}, 1)
        ON CONFLICT (period_id, dept_code)
        DO UPDATE SET next_seq = topic_code_sequences.next_seq + 1
        RETURNING next_seq
      `;

      const sequence = Number(rows?.[0]?.next_seq ?? 1);
      const code = formatTopicCode(year, departmentCode, sequence);

      const clash = await tx.topics.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!clash) return code;
    }

    throw new ConflictException(
      `Không cấp được mã đề tài cho bộ môn ${departmentCode}. Vui lòng thử lại hoặc liên hệ quản trị.`,
    );
  }

  /**
   * Đồng bộ `teacher_quotas.submitted_topics` với số đề tài thật (không tính
   * đề tài bị từ chối) để chỉ tiêu hiển thị đúng ở màn quản trị.
   */
  private async syncTeacherQuotaCounter(
    tx: Tx,
    periodId: number,
    teacherId: number,
  ): Promise<void> {
    const config = await tx.period_governance_configs.findUnique({
      where: { period_id: periodId },
      select: { default_topic_limit: true, max_students_per_topic: true },
    });
    if (!config) return;

    const submittedTopics = await tx.topics.count({
      where: {
        period_id: periodId,
        teacher_id: teacherId,
        status: { not: TopicStatus.REJECTED },
      },
    });

    const existing = await tx.teacher_quotas.findUnique({
      where: { period_id_teacher_id: { period_id: periodId, teacher_id: teacherId } },
      select: { assigned_quota: true },
    });
    const assignedQuota = existing?.assigned_quota ?? config.default_topic_limit;

    await tx.teacher_quotas.upsert({
      where: {
        period_id_teacher_id: { period_id: periodId, teacher_id: teacherId },
      },
      update: {
        submitted_topics: submittedTopics,
        status:
          submittedTopics >= assignedQuota
            ? TeacherQuotaStatus.SUFFICIENT
            : TeacherQuotaStatus.INSUFFICIENT,
      },
      create: {
        period_id: periodId,
        teacher_id: teacherId,
        assigned_quota: assignedQuota,
        submitted_topics: submittedTopics,
        max_students: assignedQuota * config.max_students_per_topic,
        status:
          submittedTopics >= assignedQuota
            ? TeacherQuotaStatus.SUFFICIENT
            : TeacherQuotaStatus.INSUFFICIENT,
      },
    });
  }

  /** Đảm bảo hồ sơ tiến độ tồn tại cho SV vừa nhận đề tài. */
  private async ensureStudentProgress(
    tx: Tx,
    studentId: number,
    now: Date,
  ): Promise<void> {
    const reportDeadlines = await tx.period_deadlines.count({
      where: {
        type: DeadlineType.PERIODIC_REPORT,
        enabled: true,
      },
    });

    await tx.student_progress.upsert({
      where: { student_id: studentId },
      update: { updated_at: now },
      create: {
        student_id: studentId,
        total_reports_required: Math.max(reportDeadlines, 1),
        created_at: now,
        updated_at: now,
      },
    });
  }

  private mapManagedRow(topic: ManagedTopic) {
    const students = (topic.projects ?? []).map((project) => {
      const summary = project.student;
      return {
        projectId: project.id,
        projectCode: project.project_id,
        studentDbId: summary?.id ?? null,
        studentCode: summary?.student_id ?? null,
        name: summary ? studentFullName(summary) : null,
        className: summary?.class_name ?? null,
        email: summary?.email ?? null,
        major: summary?.major ?? null,
        status: project.status,
        statusLabel: PROJECT_STATUS_LABELS[project.status],
        registeredAt: project.created_at.toISOString(),
        decidedAt: project.teacher_decided_at?.toISOString() ?? null,
        assignReason: project.assign_reason,
        moderatorNote: project.moderator_note,
        assignedByUserId: project.assigned_by_user_id,
        decidedByUserId: project.decided_by_user_id,
      };
    });

    const occupied = students.filter((student) =>
      SLOT_OCCUPYING_PROJECT_STATUSES.includes(student.status),
    ).length;
    const registrationSummary = summarizeRegistrations(
      students.map((student) => student.status),
    );

    return {
      id: topic.id,
      code: topic.code,
      name: topic.name,
      description: topic.description,
      maxStudents: topic.max_students,
      registeredStudents: topic.registered_students,
      occupiedStudents: occupied,
      remainingSlots: Math.max(0, topic.max_students - occupied),
      status: topic.status,
      statusLabel: TOPIC_STATUS_LABELS[topic.status],
      moderatorNote: topic.moderator_note,
      rejectionReason: topic.rejection_reason,
      isSupplemental: topic.is_supplemental,
      supplementalReason: topic.supplemental_reason,
      locked: Boolean(topic.locked_at),
      lockedAt: topic.locked_at?.toISOString() ?? null,
      periodId: topic.period_id,
      periodName: topic.registration_periods?.name ?? null,
      schoolYear: topic.registration_periods?.school_year ?? null,
      teacher: topic.teachers
        ? {
            id: topic.teachers.id,
            teacherId: topic.teachers.teacher_id,
            name: topic.teachers.name,
            email: topic.teachers.email,
            departmentId: topic.teachers.department_id,
            departmentName: topic.teachers.department?.name ?? null,
            facultyId: topic.teachers.faculty_id,
            facultyName: topic.teachers.faculty?.name ?? null,
          }
        : null,
      students,
      registrationSummary,
      registrationHeadline: registrationHeadline(registrationSummary),
      createdAt: topic.created_at.toISOString(),
      updatedAt: topic.updated_at.toISOString(),
    };
  }

  private mapTeacherTopic(
    topic: ManagedTopic,
    projects: Array<{ id: number; status: ProjectStatus }>,
  ) {
    const row = this.mapManagedRow(topic);
    const pendingApprovals = projects.filter(
      (project) =>
        project.status === ProjectStatus.PENDING ||
        project.status === ProjectStatus.WAITING_SECRETARY,
    ).length;

    return {
      id: row.id,
      code: row.code,
      periodId: row.periodId,
      periodName: row.periodName,
      name: row.name,
      description: row.description,
      maxStudents: row.maxStudents,
      status: row.status,
      statusLabel: row.statusLabel,
      moderatorNote: row.moderatorNote,
      rejectionReason: row.rejectionReason,
      locked: row.locked,
      lockedAt: row.lockedAt,
      isSupplemental: row.isSupplemental,
      registrationStatus:
        row.remainingSlots <= 0 ? 'FULL' : row.locked ? 'LOCKED' : 'OPEN',
      registeredCount: row.occupiedStudents,
      remainingSlots: row.remainingSlots,
      pendingApprovals,
      registrations: row.students,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
