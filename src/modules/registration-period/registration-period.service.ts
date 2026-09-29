import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  AlertEvent,
  AlertRecipientRole,
  DeadlineType,
  RegistrationPeriodStatus,
  TeacherQuotaStatus,
  TopicStatus,
  Prisma,
} from '@prisma/client';
import {
  CreateRegistrationPeriodDto,
  UpdateTeacherQuotaDto,
  UpdateRegistrationPeriodDto,
} from './dto';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
import { DeadlinePolicyService } from '@modules/governance/deadline-policy.service';
import { AlertDispatchService } from '@modules/admin-config/alert-dispatch.service';

@Injectable()
export class RegistrationPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deadlinePolicy: DeadlinePolicyService,
    private readonly alertDispatchService: AlertDispatchService,
  ) {}

  async create(dto: CreateRegistrationPeriodDto, actor?: JwtUser) {
    // Auto-stamp the secretary's faculty into the period so it is scoped to that faculty
    let facultyLimits = dto.facultyStudentLimits;
    if (actor?.role === 'SECRETARY') {
      const secretary = await this.prisma.secretary.findUnique({
        where: { user_id: actor.id },
        select: { faculty_id: true, faculty: { select: { name: true } } },
      });
      if (secretary?.faculty_id && (!facultyLimits || facultyLimits.length === 0)) {
        facultyLimits = [{ faculty: secretary.faculty_id, maxStudents: dto.defaultQuota ?? 3 }];
      }
    }

    return this.prisma.registration_periods.create({
      data: {
        name: dto.name,
        semester: dto.semester,
        school_year: dto.schoolYear,
        start_date: dto.startDate,
        teacher_deadline: dto.teacherDeadline ?? new Date(dto.startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        student_deadline: dto.studentDeadline ?? new Date(dto.startDate.getTime() + 14 * 24 * 60 * 60 * 1000),
        default_quota: dto.defaultQuota ?? 3,
        description: dto.description,
        faculty_student_limits:
          facultyLimits as unknown as Prisma.InputJsonArray,
        status: RegistrationPeriodStatus.UPCOMING,
        updated_at: new Date(),
      },
    });
  }

  async getTeacherFaculty(userId: number): Promise<string | null> {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId }, select: { faculty_id: true } });
    return teacher?.faculty_id || null;
  }

  async findAll(
    search?: string,
    semester?: string,
    schoolYear?: string,
    status?: RegistrationPeriodStatus,
    facultyId?: string,
  ) {
    const periods = await this.prisma.registration_periods.findMany({
      where: {
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(semester && { semester }),
        ...(schoolYear && { school_year: schoolYear }),
        ...(status && { status }),
      },
      orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
    });

    if (!facultyId) return periods;
    const quotaPeriods = await this.prisma.teacher_quotas.findMany({
      where: { teachers: { faculty_id: facultyId } },
      select: { period_id: true },
    });
    const quotaPeriodIds = new Set(quotaPeriods.map((quota) => quota.period_id));
    return periods.filter((period) => {
      const limits = period.faculty_student_limits;
      return quotaPeriodIds.has(period.id) || (
        Array.isArray(limits) &&
        limits.some(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item as { faculty?: unknown }).faculty === facultyId,
        )
      );
    });
  }

  async findOne(id: number) {
    const period = await this.prisma.registration_periods.findUnique({
      where: { id },
    });
    if (!period)
      throw new NotFoundException(`Không tìm thấy đợt đăng ký với ID ${id}`);
    return period;
  }

  // CẬP NHẬT ĐỢT ĐĂNG KÝ
  async update(id: number, dto: UpdateRegistrationPeriodDto) {
    const period = await this.findOne(id); // Kế thừa hàm findOne để check tồn tại

    if (period.status !== RegistrationPeriodStatus.UPCOMING) {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa thông tin khi đợt đăng ký đang ở trạng thái Chuẩn bị (UPCOMING)',
      );
    }

    return this.prisma.registration_periods.update({
      where: { id },
      data: {
        name: dto.name,
        semester: dto.semester,
        school_year: dto.schoolYear,
        start_date: dto.startDate,
        teacher_deadline: dto.teacherDeadline ?? (period.teacher_deadline || new Date()),
        student_deadline: dto.studentDeadline ?? (period.student_deadline || new Date()),
        default_quota: dto.defaultQuota ?? period.default_quota,
        description: dto.description,
        faculty_student_limits: dto.facultyStudentLimits
          ? (dto.facultyStudentLimits as unknown as Prisma.InputJsonArray)
          : undefined,
      },
    });
  }

  async openPeriod(id: number) {
    const period = await this.findOne(id);

    if (period.status !== RegistrationPeriodStatus.UPCOMING) {
      throw new BadRequestException(
        'Chỉ có thể mở đợt đăng ký đang ở trạng thái Chuẩn bị (UPCOMING)',
      );
    }

    return this.prisma.registration_periods.update({
      where: { id },
      data: { status: RegistrationPeriodStatus.OPEN },
    });
  }

  async closePeriod(id: number) {
    const period = await this.findOne(id);

    if (period.status !== RegistrationPeriodStatus.OPEN) {
      throw new BadRequestException(
        'Chỉ có thể đóng đợt đăng ký đang ở trạng thái Mở (OPEN)',
      );
    }

    return this.prisma.registration_periods.update({
      where: { id },
      data: { status: RegistrationPeriodStatus.CLOSED },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.registration_periods.delete({
      where: { id },
    });
  }

  // Lấy danh sách chỉ tiêu theo đợt
  async getTeacherQuotas(periodId: number, facultyId?: string) {
    await this.findOne(periodId); // Kiểm tra đợt tồn tại
    return this.prisma.teacher_quotas.findMany({
      where: {
        period_id: periodId,
        ...(facultyId ? { teachers: { faculty_id: facultyId } } : {}),
      },
      include: { teachers: { select: { name: true, faculty_id: true } } },
    });
  }

  // Cập nhật chỉ tiêu cho 1 giảng viên cụ thể
  async updateTeacherQuota(
    periodId: number,
    teacherId: number,
    dto: UpdateTeacherQuotaDto,
  ) {
    const [config, teacher] = await Promise.all([
      this.deadlinePolicy.ensureGovernanceConfig(periodId),
      this.prisma.teacher.findFirst({
        where: { id: teacherId, deleted_at: null },
        select: { id: true },
      }),
    ]);

    if (!teacher) {
      throw new NotFoundException(
        'Không tìm thấy giảng viên cần cập nhật chỉ tiêu.',
      );
    }
    if (dto.assignedQuota > config.max_topic_limit) {
      throw new BadRequestException(
        `Vượt quá trần chỉ tiêu cho phép của đợt (${config.max_topic_limit}).`,
      );
    }

    const submittedTopics = await this.prisma.topics.count({
      where: {
        period_id: periodId,
        teacher_id: teacherId,
        status: { not: TopicStatus.REJECTED },
      },
    });
    const status =
      submittedTopics >= dto.assignedQuota
        ? TeacherQuotaStatus.SUFFICIENT
        : TeacherQuotaStatus.INSUFFICIENT;

    return this.prisma.teacher_quotas.upsert({
      where: {
        period_id_teacher_id: {
          period_id: periodId,
          teacher_id: teacherId,
        },
      },
      update: {
        assigned_quota: dto.assignedQuota,
        submitted_topics: submittedTopics,
        max_students: dto.assignedQuota * config.max_students_per_topic,
        status,
        is_override: true,
      },
      create: {
        period_id: periodId,
        teacher_id: teacherId,
        assigned_quota: dto.assignedQuota,
        submitted_topics: submittedTopics,
        max_students: dto.assignedQuota * config.max_students_per_topic,
        status,
        is_override: true,
      },
    });
  }

  async notifyInsufficientTeachers(periodId: number) {
    const deadline = await this.deadlinePolicy.getDeadline(
      periodId,
      DeadlineType.TOPIC_CREATION,
    );
    if (!deadline) {
      throw new NotFoundException(
        'Đợt chưa được cấu hình deadline tạo đề tài.',
      );
    }

    const recipients = await this.alertDispatchService.resolveRecipients(
      deadline,
      AlertRecipientRole.TEACHER,
    );
    const result = await this.alertDispatchService.sendBatch(
      deadline,
      AlertEvent.DUE_IN_1_DAY,
      recipients,
    );

    if (result.sent > 0) {
      const notifiedTeacherIds = recipients.map((recipient) => recipient.id);
      await this.prisma.teacher_quotas.updateMany({
        where: {
          period_id: periodId,
          teacher_id: { in: notifiedTeacherIds },
        },
        data: { last_notified_at: new Date() },
      });
    }

    return result;
  }

  // Lấy thống kê tổng quan của đợt
  async getPeriodStats(periodId: number) {
    await this.findOne(periodId);

    const [
      totalTopics,
      pendingTopics,
      approvedTopics,
      rejectedTopics,
      totalQuotasRaw,
      insufficientTeachers,
    ] = await Promise.all([
      this.prisma.topics.count({ where: { period_id: periodId } }),
      this.prisma.topics.count({
        where: { period_id: periodId, status: TopicStatus.PENDING },
      }),
      this.prisma.topics.count({
        where: { period_id: periodId, status: TopicStatus.APPROVED },
      }),
      this.prisma.topics.count({
        where: { period_id: periodId, status: TopicStatus.REJECTED },
      }),
      this.prisma.teacher_quotas.aggregate({
        where: { period_id: periodId },
        _sum: { assigned_quota: true },
      }),
      this.prisma.teacher_quotas.count({
        where: { period_id: periodId, status: TeacherQuotaStatus.INSUFFICIENT },
      }),
    ]);

    return {
      totalTopics,
      pendingTopics,
      approvedTopics,
      rejectedTopics,
      totalQuotas: totalQuotasRaw._sum.assigned_quota || 0,
      insufficientTeachers,
    };
  }
}
