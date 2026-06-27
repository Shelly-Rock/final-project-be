import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private excelService: ExcelService,
  ) {}

  // ============== USER REPORTS ==============

  async exportAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        department: { select: { name: true } },
        major: { select: { name: true } },
        class: { select: { name: true } },
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    const data = users.map((user, index) => ({
      stt: index + 1,
      mssv: user.mssv || '',
      ho_ten: user.name || '',
      email: user.email,
      vai_tro: this.translateRole(user.role),
      khoa: user.department?.name || '',
      nganh: user.major?.name || '',
      lop: user.class?.name || '',
      trang_thai: user.isActive ? 'Hoạt động' : 'Khóa',
    }));

    return this.excelService.generateExcel(data, 'danh_sach_nguoi_dung');
  }

  async exportUsersByRole(role: string) {
    const users = await this.prisma.user.findMany({
      where: { role: role as any },
      include: {
        department: { select: { name: true } },
        major: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const data = users.map((user, index) => ({
      stt: index + 1,
      mssv: user.mssv || '',
      ho_ten: user.name || '',
      email: user.email,
      khoa: user.department?.name || '',
      nganh: user.major?.name || '',
    }));

    const sheetName = this.translateRole(role);
    return this.excelService.generateExcel(data, sheetName);
  }

  // ============== TOPIC REPORTS ==============

  async exportAllTopics(params?: { status?: string; supervisorId?: string; majorId?: string }) {
    const where: Prisma.ThesisTopicWhereInput = {};
    if (params?.status) where.status = params.status as any;
    if (params?.supervisorId) where.supervisorId = params.supervisorId;
    if (params?.majorId) where.majorId = params.majorId;

    const topics = await this.prisma.thesisTopic.findMany({
      where,
      include: {
        supervisor: { select: { name: true, email: true } },
        major: { select: { name: true } },
        _count: {
          select: {
            registrations: {
              where: { status: { in: ['APPROVED', 'PENDING'] } },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const data = topics.map((topic, index) => ({
      stt: index + 1,
      ma_de_tai: topic.code,
      ten_de_tai: topic.title,
      mo_ta: topic.description || '',
      giang_vien: topic.supervisor.name || topic.supervisor.email,
      nganh: topic.major?.name || '',
      trang_thai: this.translateTopicStatus(topic.status),
      sl_dang_ky: topic._count.registrations,
      sl_toi_da: topic.maxStudents,
      han_dang_ky: topic.deadline ? this.formatDate(topic.deadline) : 'Không giới hạn',
    }));

    return this.excelService.generateExcel(data, 'danh_sach_de_tai');
  }

  async exportTeacherTopics(teacherId: string) {
    const topics = await this.prisma.thesisTopic.findMany({
      where: { supervisorId: teacherId },
      include: {
        major: { select: { name: true } },
        registrations: {
          where: { status: { in: ['APPROVED', 'PENDING'] } },
          include: {
            student: { select: { mssv: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data: Array<Record<string, any>> = [];

    for (const topic of topics) {
      data.push({
        ma_de_tai: topic.code,
        ten_de_tai: topic.title,
        trang_thai: this.translateTopicStatus(topic.status),
        sl_sinh_vien: topic.registrations.length,
        sl_toi_da: topic.maxStudents,
        danh_sach_sv: topic.registrations
          .map((r) => `${r.student.mssv || ''} - ${r.student.name || ''}`)
          .join(', '),
      });
    }

    return this.excelService.generateExcel(data, 'de_tai_cua_toi');
  }

  // ============== REGISTRATION REPORTS ==============

  async exportRegistrations(params?: { status?: string; topicId?: string }) {
    const where: Prisma.RegistrationWhereInput = {};
    if (params?.status) where.status = params.status as any;
    if (params?.topicId) where.topicId = params.topicId;

    const registrations = await this.prisma.registration.findMany({
      where,
      include: {
        student: { select: { mssv: true, name: true, email: true } },
        topic: {
          select: { code: true, title: true, supervisor: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = registrations.map((reg, index) => ({
      stt: index + 1,
      mssv: reg.student.mssv || '',
      ho_ten: reg.student.name || '',
      email: reg.student.email,
      ma_de_tai: reg.topic.code,
      ten_de_tai: reg.topic.title,
      giang_vien: reg.topic.supervisor.name,
      thu_tu_uu_tien: reg.orderChoice,
      trang_thai: this.translateRegistrationStatus(reg.status),
      ly_do: reg.rejectionReason || '',
      ngay_dang_ky: this.formatDate(reg.createdAt),
    }));

    return this.excelService.generateExcel(data, 'danh_sach_dang_ky');
  }

  async exportApprovedRegistrations() {
    const registrations = await this.prisma.registration.findMany({
      where: { status: 'APPROVED' },
      include: {
        student: {
          select: {
            mssv: true,
            name: true,
            email: true,
            class: { select: { name: true } },
            major: { select: { name: true } },
          },
        },
        topic: {
          select: {
            code: true,
            title: true,
            supervisor: { select: { name: true } },
          },
        },
      },
      orderBy: [{ topic: { code: 'asc' } }, { student: { mssv: 'asc' } }],
    });

    const data = registrations.map((reg, index) => ({
      stt: index + 1,
      ma_de_tai: `A${(index + 1).toString().padStart(3, '0')}`,
      mssv: reg.student.mssv || '',
      ho_ten: reg.student.name || '',
      lop: reg.student.class?.name || '',
      nganh: reg.student.major?.name || '',
      email: reg.student.email,
      ten_de_tai: reg.topic.title,
      giang_vien: reg.topic.supervisor.name,
      ngay_duyet: this.formatDate(reg.approvedAt!),
    }));

    return this.excelService.generateExcel(data, 'phieu_duyet_de_tai');
  }

  // ============== DASHBOARD REPORTS ==============

  async getDashboardStats() {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalTopics,
      pendingTopics,
      approvedTopics,
      totalRegistrations,
      approvedRegistrations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.thesisTopic.count(),
      this.prisma.thesisTopic.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.thesisTopic.count({ where: { status: 'APPROVED' } }),
      this.prisma.registration.count(),
      this.prisma.registration.count({ where: { status: 'APPROVED' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        students: totalStudents,
        teachers: totalTeachers,
      },
      topics: {
        total: totalTopics,
        pending: pendingTopics,
        approved: approvedTopics,
      },
      registrations: {
        total: totalRegistrations,
        approved: approvedRegistrations,
      },
    };
  }

  // ============== HELPERS ==============

  private translateRole(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'Quản trị viên',
      SECRETARY: 'Thư ký',
      TEACHER: 'Giảng viên',
      STUDENT: 'Sinh viên',
    };
    return map[role] || role;
  }

  private translateTopicStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'Chờ phê duyệt',
      APPROVED: 'Đã duyệt',
      CLOSED: 'Đã đóng',
      REJECTED: 'Từ chối',
    };
    return map[status] || status;
  }

  private translateRegistrationStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
      CANCELLED: 'Đã hủy',
    };
    return map[status] || status;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
