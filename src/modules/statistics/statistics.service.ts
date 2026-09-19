import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '@/core/database/prisma/prisma.service';

export interface AcademicReport {
  total: number;
  published: number;
  passed: number;
  failed: number;
  rejectedDefense: number;
  rejectedGvhd: number;
  passRate: number;
  failRate: number;
  avgFinalScore: number;
}

export interface TeacherProductivityRow {
  teacherId: number;
  teacherCode: string;
  name: string;
  topics: number;
  studentsGuided: number;
  committeeSeats: number;
  committeeAsChairman: number;
  committeeAsSecretary: number;
  committeeAsInternal: number;
  committeeAsExternal: number;
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ BÁO CÁO HỌC VỤ: tỷ lệ SV đậu/rớt ============
  async getAcademicReport(periodId?: number): Promise<AcademicReport> {
    const results = await this.prisma.scoring_results.findMany({
      where: {
        final_status: { not: null },
        ...(periodId ? { projects: { topics: { period_id: periodId } } } : {}),
      },
      select: {
        final_status: true,
        final_score: true,
        is_published: true,
      },
    });

    const passed = results.filter((r) => r.final_status === 'PASSED').length;
    const rejectedDefense = results.filter(
      (r) => r.final_status === 'REJECTED_DEFENSE',
    ).length;
    const rejectedGvhd = results.filter(
      (r) => r.final_status === 'REJECTED_GVHD',
    ).length;

    const total = results.length;
    const failed = total - passed;
    const scored = results.filter((r) => r.final_score !== null);
    const avgFinalScore =
      scored.length > 0
        ? Math.round(
            (scored.reduce((s, r) => s + (r.final_score || 0), 0) /
              scored.length) *
              100,
          ) / 100
        : 0;

    return {
      total,
      published: results.filter((r) => r.is_published).length,
      passed,
      failed,
      rejectedDefense,
      rejectedGvhd,
      passRate: total ? Math.round((passed / total) * 10000) / 100 : 0,
      failRate: total ? Math.round((failed / total) * 10000) / 100 : 0,
      avgFinalScore,
    };
  }

  // ============ BÁO CÁO NĂNG SUẤT GIẢNG VIÊN ============
  async getTeacherProductivity(
    periodId?: number,
  ): Promise<TeacherProductivityRow[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: { deleted_at: null },
      select: { id: true, teacher_id: true, name: true },
      orderBy: { teacher_id: 'asc' },
    });
    const teacherIds = teachers.map((t) => t.id);
    if (teacherIds.length === 0) return [];

    const committeeFilter = periodId
      ? { defense_committees: { period_id: periodId, deleted_at: null } }
      : { defense_committees: { deleted_at: null } };

    const [topicGroups, projects, members, externals] = await Promise.all([
      this.prisma.topics.groupBy({
        by: ['teacher_id'],
        where: {
          teacher_id: { in: teacherIds },
          ...(periodId ? { period_id: periodId } : {}),
        },
        _count: { _all: true },
      }),
      this.prisma.project.findMany({
        where: {
          teacher_id: { in: teacherIds },
          deleted_at: null,
          ...(periodId ? { topics: { period_id: periodId } } : {}),
        },
        select: { teacher_id: true, student_id: true },
      }),
      this.prisma.committee_members.findMany({
        where: {
          teacher_id: { in: teacherIds },
          ...committeeFilter,
        },
        select: { teacher_id: true, role: true },
      }),
      this.prisma.committee_external_reviewers.findMany({
        where: {
          teacher_id: { in: teacherIds },
          ...committeeFilter,
        },
        select: { teacher_id: true },
      }),
    ]);

    const topicsByTeacher = new Map(
      topicGroups.map((g) => [g.teacher_id, g._count._all]),
    );

    const studentsByTeacher = new Map<number, Set<number>>();
    for (const p of projects) {
      const set = studentsByTeacher.get(p.teacher_id) ?? new Set<number>();
      set.add(p.student_id);
      studentsByTeacher.set(p.teacher_id, set);
    }

    const seatsByTeacher = new Map<
      number,
      {
        chairman: number;
        secretary: number;
        internal: number;
        external: number;
      }
    >();
    const seatOf = (tid: number) => {
      let rec = seatsByTeacher.get(tid);
      if (!rec) {
        rec = { chairman: 0, secretary: 0, internal: 0, external: 0 };
        seatsByTeacher.set(tid, rec);
      }
      return rec;
    };
    for (const m of members) {
      const rec = seatOf(m.teacher_id);
      if (m.role === 'CHAIRMAN') rec.chairman += 1;
      else if (m.role === 'SECRETARY') rec.secretary += 1;
      else if (m.role === 'EXTERNAL_REVIEWER') rec.external += 1;
      else rec.internal += 1;
    }
    for (const e of externals) seatOf(e.teacher_id).external += 1;

    return teachers.map((t) => {
      const seats = seatOf(t.id);
      return {
        teacherId: t.id,
        teacherCode: t.teacher_id,
        name: t.name,
        topics: topicsByTeacher.get(t.id) ?? 0,
        studentsGuided: studentsByTeacher.get(t.id)?.size ?? 0,
        committeeSeats:
          seats.chairman + seats.secretary + seats.internal + seats.external,
        committeeAsChairman: seats.chairman,
        committeeAsSecretary: seats.secretary,
        committeeAsInternal: seats.internal,
        committeeAsExternal: seats.external,
      };
    });
  }

  // ============ XUẤT EXCEL TOÀN BỘ SỐ LIỆU THỐNG KÊ ============
  async exportStatistics(periodId?: number): Promise<Buffer> {
    const [academic, teachers, periods] = await Promise.all([
      this.getAcademicReport(periodId),
      this.getTeacherProductivity(periodId),
      this.prisma.registration_periods.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const periodName = periodId
      ? (periods.find((p) => p.id === periodId)?.name ?? `Kỳ #${periodId}`)
      : 'Tất cả kỳ';

    const workbook = new Workbook();
    workbook.creator = 'HeThongQuanLyDoAn';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Báo cáo học vụ');
    summary.columns = [
      { header: 'Chỉ tiêu', key: 'label', width: 36 },
      { header: 'Giá trị', key: 'value', width: 24 },
    ];
    summary.getRow(1).font = { bold: true };
    summary.addRow({ label: 'Kỳ báo cáo', value: periodName });
    summary.addRow({
      label: 'Tổng đề tài đã có kết quả bảo vệ',
      value: academic.total,
    });
    summary.addRow({ label: 'Đã công bố điểm', value: academic.published });
    summary.addRow({ label: 'Đậu', value: academic.passed });
    summary.addRow({ label: 'Rớt', value: academic.failed });
    summary.addRow({
      label: 'Rớt do hội đồng (REJECTED_DEFENSE)',
      value: academic.rejectedDefense,
    });
    summary.addRow({
      label: 'Rớt do GVHD (REJECTED_GVHD)',
      value: academic.rejectedGvhd,
    });
    summary.addRow({ label: 'Tỷ lệ đậu (%)', value: academic.passRate });
    summary.addRow({ label: 'Tỷ lệ rớt (%)', value: academic.failRate });
    summary.addRow({ label: 'Điểm trung bình', value: academic.avgFinalScore });

    const productivity = workbook.addWorksheet('Năng suất giảng viên');
    productivity.columns = [
      { header: 'Mã GV', key: 'teacherCode', width: 14 },
      { header: 'Họ tên', key: 'name', width: 28 },
      { header: 'Số đề tài đã ra', key: 'topics', width: 14 },
      { header: 'Tổng SV hướng dẫn', key: 'studentsGuided', width: 16 },
      { header: 'Số ghế hội đồng', key: 'committeeSeats', width: 14 },
      { header: 'Chủ tịch', key: 'committeeAsChairman', width: 10 },
      { header: 'Thư ký', key: 'committeeAsSecretary', width: 10 },
      { header: 'Phản biện trong', key: 'committeeAsInternal', width: 14 },
      { header: 'Phản biện ngoài', key: 'committeeAsExternal', width: 14 },
    ];
    productivity.getRow(1).font = { bold: true };
    productivity.views = [{ state: 'frozen', ySplit: 1 }];
    for (const row of teachers) {
      productivity.addRow(row);
    }

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }
}
