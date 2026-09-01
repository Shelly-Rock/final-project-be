import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
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

@Injectable()
export class RegistrationPeriodService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRegistrationPeriodDto) {
    return this.prisma.registration_periods.create({
      data: {
        name: dto.name,
        semester: dto.semester,
        school_year: dto.schoolYear,
        start_date: dto.startDate,
        teacher_deadline: dto.teacherDeadline,
        student_deadline: dto.studentDeadline,
        default_quota: dto.defaultQuota,
        description: dto.description,
        department_student_limits:
          dto.departmentStudentLimits as unknown as Prisma.InputJsonArray,
        status: RegistrationPeriodStatus.UPCOMING,
        updated_at: new Date(),
      },
    });
  }

  async findAll(
    search?: string,
    semester?: string,
    schoolYear?: string,
    status?: RegistrationPeriodStatus,
  ) {
    return this.prisma.registration_periods.findMany({
      where: {
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(semester && { semester }),
        ...(schoolYear && { school_year: schoolYear }),
        ...(status && { status }),
      },
      orderBy: { start_date: 'desc' },
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
        teacher_deadline: dto.teacherDeadline,
        student_deadline: dto.studentDeadline,
        default_quota: dto.defaultQuota,
        description: dto.description,
        department_student_limits: dto.departmentStudentLimits
          ? (dto.departmentStudentLimits as unknown as Prisma.InputJsonArray)
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
  async getTeacherQuotas(periodId: number) {
    await this.findOne(periodId); // Kiểm tra đợt tồn tại
    return this.prisma.teacher_quotas.findMany({
      where: { period_id: periodId },
      include: { teachers: { select: { name: true, department_id: true } } },
    });
  }

  // Cập nhật chỉ tiêu cho 1 giảng viên cụ thể
  async updateTeacherQuota(
    periodId: number,
    teacherId: number,
    dto: UpdateTeacherQuotaDto,
  ) {
    const quota = await this.prisma.teacher_quotas.findFirst({
      where: { period_id: periodId, teacher_id: teacherId },
    });

    if (!quota)
      throw new NotFoundException(
        'Không tìm thấy chỉ tiêu của giảng viên này trong đợt',
      );
    const newStatus =
      quota.submitted_topics >= dto.assignedQuota
        ? TeacherQuotaStatus.SUFFICIENT
        : TeacherQuotaStatus.INSUFFICIENT;

    const period = await this.findOne(periodId);
    let deptMaxStudents = 3;

    if (
      period.department_student_limits &&
      Array.isArray(period.department_student_limits)
    ) {
      deptMaxStudents = 3;
    }

    return this.prisma.teacher_quotas.update({
      where: { id: quota.id },
      data: {
        assigned_quota: dto.assignedQuota,
        max_students: dto.assignedQuota * deptMaxStudents,
        status: newStatus,
      },
    });
  }

  async notifyInsufficientTeachers(periodId: number) {
    const insufficientQuotas = await this.prisma.teacher_quotas.findMany({
      where: {
        period_id: periodId,
        status: TeacherQuotaStatus.INSUFFICIENT,
      },
    });

    await this.prisma.teacher_quotas.updateMany({
      where: {
        period_id: periodId,
        status: TeacherQuotaStatus.INSUFFICIENT,
      },
      data: { last_notified_at: new Date() },
    });

    return {
      message: `Đã gửi nhắc nhở cho ${insufficientQuotas.length} giảng viên chưa đủ chỉ tiêu.`,
      notifiedCount: insufficientQuotas.length,
    };
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
