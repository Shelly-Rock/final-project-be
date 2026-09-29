import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  ProjectStatus,
  ReportStatus,
  TeacherQuotaStatus,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDashboard() {
    const [
      totalStudents,
      totalTeachers,
      totalProjects,
      totalFaculties,
      totalTopics,
      pendingProjects,
      approvedProjects,
      rejectedProjects,
      pendingReports,
      approvedReports,
      rejectedReports,
      activeTopics,
      insufficientQuotas,
    ] = await Promise.all([
      this.prisma.student.count({ where: { deleted_at: null } }),
      this.prisma.teacher.count({ where: { deleted_at: null } }),
      this.prisma.project.count({ where: { deleted_at: null } }),
      this.prisma.faculty.count(),
      this.prisma.topics.count(),
      this.prisma.project.count({
        where: { status: ProjectStatus.PENDING, deleted_at: null },
      }),
      this.prisma.project.count({
        where: { status: ProjectStatus.APPROVED, deleted_at: null },
      }),
      this.prisma.project.count({
        where: { status: ProjectStatus.REJECTED, deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: { status: ReportStatus.PENDING, deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: { status: ReportStatus.APPROVED, deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: { status: ReportStatus.REJECTED, deleted_at: null },
      }),
      this.prisma.topics.count(),
      this.prisma.teacher_quotas.count({
        where: { status: TeacherQuotaStatus.INSUFFICIENT },
      }),
    ]);

    const facultyStats = await this.getFacultyStats();
    const topRecentActivities = await this.getRecentActivities(5);

    return {
      overview: {
        students: totalStudents,
        teachers: totalTeachers,
        projects: totalProjects,
        faculties: totalFaculties,
        topics: totalTopics,
        alerts: insufficientQuotas,
      },
      projectStats: {
        pending: pendingProjects,
        approved: approvedProjects,
        rejected: rejectedProjects,
        total: pendingProjects + approvedProjects + rejectedProjects,
      },
      reportStats: {
        pending: pendingReports,
        approved: approvedReports,
        rejected: rejectedReports,
        total: pendingReports + approvedReports + rejectedReports,
      },
      topicStats: {
        active: activeTopics,
        insufficientQuotas,
      },
      facultyStats,
      recentActivities: topRecentActivities,
    };
  }

  async getSecretaryDashboard(facultyId: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        secretaries: {
          include: { user: true },
        },
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    if (!faculty) {
      throw new Error(`Faculty ${facultyId} not found`);
    }

    const teacherIds = faculty.teachers.map((t) => t.id);

    const [
      totalStudents,
      totalProjects,
      totalTopics,
      pendingProjects,
      approvedProjects,
      rejectedProjects,
      pendingReports,
      approvedReports,
      rejectedReports,
    ] = await Promise.all([
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIds },
          deleted_at: null,
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIds },
          deleted_at: null,
        },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIds },
          status: ProjectStatus.PENDING,
          deleted_at: null,
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIds },
          status: ProjectStatus.APPROVED,
          deleted_at: null,
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIds },
          status: ProjectStatus.REJECTED,
          deleted_at: null,
        },
      }),
      this.prisma.progress_reports.count({
        where: {
          status: ReportStatus.PENDING,
          deleted_at: null,
          teacher_id: { in: teacherIds },
        },
      }),
      this.prisma.progress_reports.count({
        where: {
          status: ReportStatus.APPROVED,
          deleted_at: null,
          teacher_id: { in: teacherIds },
        },
      }),
      this.prisma.progress_reports.count({
        where: {
          status: ReportStatus.REJECTED,
          deleted_at: null,
          teacher_id: { in: teacherIds },
        },
      }),
    ]);

    return {
      faculty: {
        id: faculty.id,
        name: faculty.name,
        faculty: faculty.name,
      },
      summary: {
        totalStudents,
        totalTeachers: faculty.teachers.length,
        totalProjects,
        totalTopics,
      },
      projectStats: {
        pending: pendingProjects,
        approved: approvedProjects,
        rejected: rejectedProjects,
        total: totalProjects,
      },
      reportStats: {
        pending: pendingReports,
        approved: approvedReports,
        rejected: rejectedReports,
        total: pendingReports + approvedReports + rejectedReports,
      },
    };
  }

  async getFacultyUnitStats() {
    const facultys = await this.prisma.faculty.findMany({
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
        secretaries: {
          include: { user: { select: { username: true, email: true } } },
        },
      },
      orderBy: { id: 'asc' },
    });

    return Promise.all(
      facultys.map(async (dept) => {
        const teacherIds = dept.teachers.map((t) => t.id);

        const [projectCount, topicCount, pending, approved, rejected, reports] =
          await Promise.all([
            this.prisma.project.count({
              where: { teacher_id: { in: teacherIds }, deleted_at: null },
            }),
            this.prisma.topics.count({
              where: { teacher_id: { in: teacherIds } },
            }),
            this.prisma.project.count({
              where: {
                teacher_id: { in: teacherIds },
                status: ProjectStatus.PENDING,
                deleted_at: null,
              },
            }),
            this.prisma.project.count({
              where: {
                teacher_id: { in: teacherIds },
                status: ProjectStatus.APPROVED,
                deleted_at: null,
              },
            }),
            this.prisma.project.count({
              where: {
                teacher_id: { in: teacherIds },
                status: ProjectStatus.REJECTED,
                deleted_at: null,
              },
            }),
            this.prisma.progress_reports.count({
              where: { teacher_id: { in: teacherIds }, deleted_at: null },
            }),
          ]);

        return {
          id: dept.id,
          faculty_id: dept.id,
          faculty_name: dept.name,
          name: dept.name,
          faculty: dept.name,
          secretary: dept.secretaries[0]
            ? dept.secretaries[0].user?.username
            : 'Chưa gán',
          teachers: dept.teachers.length,
          teacherCount: dept.teachers.length,
          projects: {
            total: projectCount,
            pending,
            approved,
            rejected,
          },
          topics: topicCount,
          reports,
        };
      }),
    );
  }

  /**
   * Thống kê tổng hợp theo KHOA.
   * Thống kê trực tiếp theo khoa.
   */
  async getFacultyStats() {
    const faculties = await this.prisma.faculty.findMany({
      orderBy: { created_at: 'desc' },
    });

    const facultyStats = await this.getFacultyUnitStats();

    return faculties.map((faculty) => {
      const facultys = facultyStats.filter(
        (d) => d.faculty_id === faculty.id,
      );

      const sum = (key: 'total' | 'pending' | 'approved' | 'rejected') =>
        facultys.reduce((acc, d) => acc + (d.projects[key] ?? 0), 0);

      return {
        id: faculty.id,
        name: faculty.name,
        description: faculty.description,
        is_active: faculty.is_active,
        teacher_count: facultys.reduce((acc, d) => acc + d.teachers, 0),
        projects: {
          total: sum('total'),
          pending: sum('pending'),
          approved: sum('approved'),
          rejected: sum('rejected'),
        },
        reports: facultys.reduce((acc, d) => acc + d.reports, 0),
      };
    });
  }

  /**
   * Chi tiết một KHOA: thông tin khoa + tổng hợp số liệu.
   */
  async getFacultyDetail(facultyId: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
    });

    if (!faculty) {
      throw new NotFoundException('Không tìm thấy khoa');
    }

    const facultyStats = await this.getFacultyUnitStats();
    const facultys = facultyStats.filter(
      (d) => d.faculty_id === facultyId,
    );

    return {
      faculty: {
        id: faculty.id,
        name: faculty.name,
        description: faculty.description,
        is_active: faculty.is_active,
      },
      summary: {
        teacher_count: facultys.reduce((acc, d) => acc + d.teachers, 0),
        topic_count: facultys.reduce((acc, d) => acc + d.topics, 0),
        report_count: facultys.reduce((acc, d) => acc + d.reports, 0),
        projects: {
          total: facultys.reduce((acc, d) => acc + d.projects.total, 0),
          pending: facultys.reduce((acc, d) => acc + d.projects.pending, 0),
          approved: facultys.reduce(
            (acc, d) => acc + d.projects.approved,
            0,
          ),
          rejected: facultys.reduce(
            (acc, d) => acc + d.projects.rejected,
            0,
          ),
        },
      },
    };
  }

  async getSecretaryFacultyId(userId: number): Promise<string | null> {
    try {
      const secretary = await this.prisma.secretary.findUnique({
        where: { user_id: userId },
        select: { faculty_id: true },
      });
      return secretary?.faculty_id || null;
    } catch (error) {
      // Fallback if faculty_id column doesn't exist in production
      console.log('Note: Secretary faculty migration not yet applied');
      return null;
    }
  }

  private async assertCanAccessFaculty(user: any, facultyId: string) {
    const role = user?.role || 'USER';

    if (role === 'ADMIN') return;

    if (role === 'SECRETARY') {
      const userId = Number(user.sub);
      if (Number.isNaN(userId)) {
        throw new ForbiddenException('Invalid secretary user');
      }

      const secretaryDeptId = await this.getSecretaryFacultyId(userId);
      if (!secretaryDeptId) {
        throw new ForbiddenException('Thư ký chưa được gán khoa');
      }

      // Route mang MÃ KHOA: cho phép khi khoa của thư ký trùng mã này.
      const ownFaculty = await this.prisma.faculty.findUnique({
        where: { id: secretaryDeptId },
        select: { id: true },
      });

      if (ownFaculty?.id === facultyId) {
        return;
      }

      throw new ForbiddenException('Bạn không có quyền truy cập khoa này');
    }

    throw new ForbiddenException('Unauthorized');
  }

  async getSecretaryFacultyDetails(facultyId: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        teachers: {
          where: { deleted_at: null },
          include: {
            project: {
              select: { id: true, status: true, project_name: true },
            },
          },
        },
      },
    });

    if (!faculty) {
      throw new Error(`Faculty ${facultyId} not found`);
    }

    return {
      faculty: {
        id: faculty.id,
        name: faculty.name,
      },
      teachers: faculty.teachers.map((teacher) => {
        const projects = teacher.project;
        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          position: teacher.position,
          projects: {
            total: projects.length,
            byStatus: {
              pending: projects.filter((p) => p.status === 'PENDING').length,
              approved: projects.filter((p) => p.status === 'APPROVED').length,
              rejected: projects.filter((p) => p.status === 'REJECTED').length,
            },
          },
        };
      }),
    };
  }

  async getFacultyStatsWithProjectCounts() {
    const facultys = await this.prisma.faculty.findMany({
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    return Promise.all(
      facultys.map(async (dept) => {
        const [pending, approved, rejected] = await Promise.all([
          this.prisma.project.count({
            where: {
              teacher_id: { in: dept.teachers.map((t) => t.id) },
              status: ProjectStatus.PENDING,
              deleted_at: null,
            },
          }),
          this.prisma.project.count({
            where: {
              teacher_id: { in: dept.teachers.map((t) => t.id) },
              status: ProjectStatus.APPROVED,
              deleted_at: null,
            },
          }),
          this.prisma.project.count({
            where: {
              teacher_id: { in: dept.teachers.map((t) => t.id) },
              status: ProjectStatus.REJECTED,
              deleted_at: null,
            },
          }),
        ]);

        const total = pending + approved + rejected;

        return {
          faculty_id: dept.id,
          faculty_name: dept.name,
          faculty: dept.name,
          teachers: dept.teachers.length,
          projects: {
            total,
            pending,
            approved,
            rejected,
          },
        };
      }),
    );
  }

  private async getRecentActivities(limit: number = 5) {
    const auditLogs = await this.prisma.audit_logs.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { actor: true },
    });

    return auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      actor: log.actor.username,
      timestamp: log.created_at,
    }));
  }

  async getFacultyListScoped(user: any) {
    const role = user?.role || 'USER';

    if (role === 'ADMIN') {
      return this.getFacultyStatsWithProjectCounts();
    }

    if (role === 'SECRETARY') {
      const userId = Number(user.sub);
      if (Number.isNaN(userId)) {
        throw new ForbiddenException('Invalid secretary user');
      }

      const facultyId = await this.getSecretaryFacultyId(userId);
      if (!facultyId) {
        throw new ForbiddenException('Thư ký chưa được gán khoa');
      }

      const deptStats = await this.getFacultyStatsWithProjectCounts();
      return deptStats.filter((d) => d.faculty_id === facultyId);
    }

    throw new ForbiddenException('Unauthorized');
  }

  /**
   * Route /faculty/:id mang MÃ KHOA.
   * Số liệu được tính từ toàn bộ giảng viên thuộc khoa đó.
   */
  private async resolveFacultyScope(facultyId: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
    });

    if (!faculty) return null;

    const teacherIds = (await this.prisma.teacher.findMany({
      where: { faculty_id: facultyId, deleted_at: null },
      select: { id: true },
    })).map((t) => t.id);

    return { faculty, teacherIds };
  }

  async getFacultyDetailScoped(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);

    const scope = await this.resolveFacultyScope(facultyId);

    if (!scope) {
      throw new NotFoundException('Không tìm thấy khoa');
    }

    const { faculty, teacherIds: teacherIdList } = scope;

    const [pending, approved, rejected] = await Promise.all([
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIdList },
          status: ProjectStatus.PENDING,
          deleted_at: null,
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIdList },
          status: ProjectStatus.APPROVED,
          deleted_at: null,
        },
      }),
      this.prisma.project.count({
        where: {
          teacher_id: { in: teacherIdList },
          status: ProjectStatus.REJECTED,
          deleted_at: null,
        },
      }),
    ]);

    const total = pending + approved + rejected;

    return {
      faculty_id: faculty.id,
      faculty_name: faculty.name,
      teachers: teacherIdList.length,
      projects: {
        total,
        pending,
        approved,
        rejected,
      },
    };
  }

  async getFacultyProgressReportsScoped(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);

    const scope = await this.resolveFacultyScope(facultyId);

    if (!scope) {
      throw new NotFoundException('Không tìm thấy khoa');
    }

    const deptName = scope.faculty.name;
    const teacherIdList = scope.teacherIds;

    const reports = await this.prisma.progress_reports.findMany({
      where: {
        teacher_id: { in: teacherIdList },
        deleted_at: null,
      },
      select: {
        year: true,
        month: true,
        status: true,
      },
    });

    const summary = {
      total: reports.length,
      pending: reports.filter((r) => r.status === 'PENDING').length,
      approved: reports.filter((r) => r.status === 'APPROVED').length,
      rejected: reports.filter((r) => r.status === 'REJECTED').length,
    };

    const grouped = new Map<string, Record<string, number>>();

    reports.forEach((report) => {
      const key = `${report.year}-${String(report.month).padStart(2, '0')}`;
      if (!grouped.has(key)) {
        grouped.set(key, { pending: 0, approved: 0, rejected: 0, total: 0 });
      }
      const counts = grouped.get(key);
      counts[report.status.toLowerCase()] =
        (counts[report.status.toLowerCase()] || 0) + 1;
      counts.total += 1;
    });

    const series = Array.from(grouped.entries())
      .map(([key, counts]) => {
        const [year, month] = key.split('-');
        const monthNum = parseInt(month, 10);
        const monthNames = [
          'Tháng 1',
          'Tháng 2',
          'Tháng 3',
          'Tháng 4',
          'Tháng 5',
          'Tháng 6',
          'Tháng 7',
          'Tháng 8',
          'Tháng 9',
          'Tháng 10',
          'Tháng 11',
          'Tháng 12',
        ];
        return {
          year: parseInt(year, 10),
          month: monthNum,
          label: monthNames[monthNum - 1],
          pending: counts.pending,
          approved: counts.approved,
          rejected: counts.rejected,
          total: counts.total,
        };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);

    return {
      faculty: {
        id: facultyId,
        name: deptName,
      },
      summary,
      series,
    };
  }

  async getSecretaryFacultyOverview(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);

    const dept = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException('Faculty not found');
    }

    const teacherIds = dept.teachers.map((t) => t.id);

    const [
      totalProjects,
      completedTopics,
      pendingTopics,
      failedTopics,
      totalReports,
      pendingReports,
      approvedReports,
      rejectedReports,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { teacher_id: { in: teacherIds }, deleted_at: null },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'APPROVED',
        },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'PENDING',
        },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'REJECTED',
        },
      }),
      this.prisma.progress_reports.count({
        where: { teacher_id: { in: teacherIds }, deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'PENDING',
          deleted_at: null,
        },
      }),
      this.prisma.progress_reports.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'APPROVED',
          deleted_at: null,
        },
      }),
      this.prisma.progress_reports.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'REJECTED',
          deleted_at: null,
        },
      }),
    ]);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      select: {
        id: true,
        name: true,
        status: true,
        teacher_id: true,
      },
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    // Get teacher info separately
    const topicTeacherMap = new Map();
    const uniqueTopicTeacherIds = [...new Set(topics.map((t) => t.teacher_id))];
    const topicTeachers = await this.prisma.teacher.findMany({
      where: { id: { in: uniqueTopicTeacherIds } },
      select: { id: true, name: true },
    });
    topicTeachers.forEach((t) => topicTeacherMap.set(t.id, t));

    return {
      faculty: {
        id: dept.id,
        name: dept.name,
        faculty: dept.name,
        code: dept.id,
        status: 'Đang hoạt động',
      },
      stats: {
        teachers: dept.teachers.length,
        projects: totalProjects,
        reports: totalReports,
        pendingReports,
      },
      topicDistribution: {
        completed: completedTopics,
        pending: pendingTopics,
        failed: failedTopics,
        total: completedTopics + pendingTopics + failedTopics,
      },
      reportStats: {
        pending: pendingReports,
        approved: approvedReports,
        rejected: rejectedReports,
        total: totalReports,
      },
      recentTopics: topics.map((t) => ({
        id: `TOPIC-${t.id}`,
        name: t.name,
        code: `TOPIC-${t.id}`,
        teacher: topicTeacherMap.get(t.teacher_id) || {
          id: t.teacher_id,
          name: 'Unknown',
        },
        status: t.status,
        completionPercentage: 100,
      })),
    };
  }

  async getSecretaryFacultyTopics(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);

    const dept = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException('Faculty not found');
    }

    const teacherIds = dept.teachers.map((t) => t.id);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      select: {
        id: true,
        name: true,
        status: true,
        created_at: true,
        teacher_id: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Get teacher info separately
    const teacherMap = new Map();
    const uniqueTeacherIds = [...new Set(topics.map((t) => t.teacher_id))];
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: uniqueTeacherIds } },
      select: { id: true, name: true, email: true },
    });
    teachers.forEach((t) => teacherMap.set(t.id, t));

    return {
      total: topics.length,
      data: topics.map((t) => ({
        id: t.id,
        name: t.name,
        code: `TOPIC-${t.id}`,
        teacher: teacherMap.get(t.teacher_id) || {
          id: t.teacher_id,
          name: 'Unknown',
          email: '',
        },
        status: t.status,
        completionPercentage:
          t.status === 'APPROVED' ? 100 : t.status === 'PENDING' ? 50 : 0,
        createdAt: t.created_at,
      })),
    };
  }

  /** Action items shown on the secretary dashboard, always scoped to her faculty. */
  async getSecretaryFacultyActions(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { id: true, name: true, teachers: { where: { deleted_at: null }, select: { id: true } } },
    });
    if (!faculty) throw new NotFoundException('Faculty not found');

    const teacherIds = faculty.teachers.map((teacher) => teacher.id);
    const period = await this.prisma.registration_periods.findFirst({
      where: { status: 'OPEN' },
      orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
      select: { id: true, student_deadline: true, teacher_deadline: true },
    }) ?? await this.prisma.registration_periods.findFirst({
      orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
      select: { id: true, student_deadline: true, teacher_deadline: true },
    });

    const [waitingSecretary, overdueReports, unlockedTopics, overQuota, missingSubmissions] =
      await Promise.all([
        this.prisma.project.count({
          where: { teacher_id: { in: teacherIds }, status: 'WAITING_SECRETARY', deleted_at: null },
        }),
        this.prisma.progress_reports.count({
          where: { teacher_id: { in: teacherIds }, status: 'PENDING', deleted_at: null },
        }),
        this.prisma.topics.count({
          where: { teacher_id: { in: teacherIds }, ...(period ? { period_id: period.id } : {}), locked_at: null },
        }),
        period
          ? this.prisma.teacher_quotas.count({
              where: { period_id: period.id, teacher_id: { in: teacherIds }, submitted_topics: { gt: 0 }, status: 'INSUFFICIENT' },
            })
          : Promise.resolve(0),
        this.prisma.topics.count({
          where: { teacher_id: { in: teacherIds }, ...(period ? { period_id: period.id } : {}), final_submissions: null },
        }),
      ]);

    const due = (count: number) => count > 0 ? 'due' as const : 'later' as const;
    return {
      faculty: { id: faculty.id, name: faculty.name },
      periodId: period?.id ?? null,
      items: [
        { id: 'reg', title: `${waitingSecretary} đăng ký chờ thư ký xác nhận`, subtitle: waitingSecretary ? 'Cần duyệt đăng ký trong khoa' : 'Chưa có đăng ký chờ xác nhận', tone: due(waitingSecretary), href: '/project-config' },
        { id: 'reports', title: `${overdueReports} báo cáo tiến trình chờ xử lý`, subtitle: overdueReports ? 'Kiểm tra và nhắc giảng viên hướng dẫn' : 'Không có báo cáo chờ xử lý', tone: due(overdueReports), href: '/progress-tracking/admin' },
        { id: 'topics', title: `${unlockedTopics} đề tài chưa khóa`, subtitle: unlockedTopics ? 'Cần hoàn tất danh sách đề tài của khoa' : 'Danh sách đề tài đã khóa', tone: due(unlockedTopics), href: '/project-config' },
        { id: 'quota', title: `${overQuota} giảng viên vượt định mức`, subtitle: overQuota ? 'Cần rà soát và phân bổ lại chỉ tiêu' : 'Định mức hướng dẫn đang ổn', tone: due(overQuota), href: '/project-config' },
        { id: 'submissions', title: `${missingSubmissions} đề tài thiếu bài nộp cuối kỳ`, subtitle: missingSubmissions ? 'Theo dõi sinh viên chưa nộp bài' : 'Không có bài nộp cuối kỳ bị thiếu', tone: due(missingSubmissions), href: '/submission/admin' },
      ],
    };
  }

  async getFacultyUpcomingEvents(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);
    const now = new Date();
    const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const [periods, deadlines, sessions] = await Promise.all([
      this.prisma.registration_periods.findMany({
        where: { OR: [{ student_deadline: { gte: now, lte: until } }, { teacher_deadline: { gte: now, lte: until } }] },
        select: { id: true, name: true, student_deadline: true, teacher_deadline: true },
      }),
      this.prisma.period_deadlines.findMany({
        where: { enabled: true, deadline_at: { gte: now, lte: until } },
        select: { id: true, period_id: true, label: true, type: true, deadline_at: true },
        orderBy: { deadline_at: 'asc' },
      }),
      this.prisma.defense_sessions.findMany({
        where: {
          status: 'SCHEDULED', deleted_at: null, defense_date: { gte: now, lte: until },
          defense_committees: { defense_sessions: { some: { defense_session_projects: { some: { projects: { teacher: { faculty_id: facultyId } } } } } } },
        },
        include: { defense_committees: { select: { name: true } } },
      }),
    ]);

    const events = new Map<string, { id: string; at: Date; title: string; detail: string }>();
    for (const period of periods) {
      for (const item of [
        { key: 'student', at: period.student_deadline, title: 'Hạn xác nhận đăng ký sinh viên' },
        { key: 'teacher', at: period.teacher_deadline, title: 'Hạn giảng viên nộp đề tài' },
      ]) {
        if (item.at < now || item.at > until) continue;
        const key = `${item.title}:${item.at.toISOString()}`;
        events.set(key, { id: `period-${period.id}-${item.key}`, at: item.at, title: item.title, detail: `${period.name} · ${item.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` });
      }
    }
    for (const deadline of deadlines) {
      const key = `${deadline.label}:${deadline.deadline_at.toISOString()}`;
      events.set(key, { id: `deadline-${deadline.id}`, at: deadline.deadline_at, title: deadline.label, detail: deadline.deadline_at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) });
    }
    for (const session of sessions) {
      const at = new Date(`${session.defense_date.toISOString().slice(0, 10)}T${session.start_time}`);
      events.set(`defense-${session.id}`, { id: `defense-${session.id}`, at, title: `Bảo vệ · ${session.defense_committees.name}`, detail: `${session.start_time} · ${session.room}` });
    }
    return [...events.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).map((event) => ({ ...event, at: event.at.toISOString() }));
  }

  async getFacultySecretaryDetail(facultyId: string, user: any) {
    await this.assertCanAccessFaculty(user, facultyId);

    const dept = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true, name: true, email: true, position: true },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException('Faculty not found');
    }

    const teacherIds = dept.teachers.map((t) => t.id);

    const [
      completedTopics,
      pendingTopics,
      delayedTopics,
      totalReports,
      pendingReports,
    ] = await Promise.all([
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'APPROVED',
        },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'PENDING',
        },
      }),
      this.prisma.topics.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'REJECTED',
        },
      }),
      this.prisma.progress_reports.count({
        where: { teacher_id: { in: teacherIds }, deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: {
          teacher_id: { in: teacherIds },
          status: 'PENDING',
          deleted_at: null,
        },
      }),
    ]);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      select: {
        id: true,
        name: true,
        status: true,
        created_at: true,
        teacher_id: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const teacherMap = new Map();
    dept.teachers.forEach((t) =>
      teacherMap.set(t.id, {
        name: t.name,
        email: t.email,
        position: t.position,
      }),
    );

    return {
      facultyId: dept.id,
      facultyName: dept.name,
      facultyCode: dept.id,
      totalTeachers: dept.teachers.length,
      totalTopics: completedTopics + pendingTopics + delayedTopics,
      completedTopics,
      pendingApprovalTopics: pendingTopics,
      delayedTopics,
      totalReports,
      pendingApprovals: pendingReports,
      topics: topics.map((t) => {
        const teacher = teacherMap.get(t.teacher_id) || {
          name: 'Unknown',
          position: 'Giảng viên',
        };
        return {
          id: t.id,
          name: t.name,
          code: `TOPIC-${t.id}`,
          instructorName: teacher.name,
          instructorRole: teacher.position || 'Giảng viên',
          completionPercentage:
            t.status === 'APPROVED' ? 100 : t.status === 'PENDING' ? 50 : 0,
          status:
            t.status === 'APPROVED'
              ? 'completed'
              : t.status === 'PENDING'
                ? 'pending'
                : 'delayed',
        };
      }),
    };
  }
}
