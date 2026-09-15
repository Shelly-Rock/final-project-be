import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { ProjectStatus, ReportStatus, TeacherQuotaStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDashboard() {
    const [
      totalStudents,
      totalTeachers,
      totalProjects,
      totalDepartments,
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
      this.prisma.department.count(),
      this.prisma.topics.count(),
      this.prisma.project.count({ where: { status: ProjectStatus.PENDING, deleted_at: null } }),
      this.prisma.project.count({ where: { status: ProjectStatus.APPROVED, deleted_at: null } }),
      this.prisma.project.count({ where: { status: ProjectStatus.REJECTED, deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.PENDING, deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.APPROVED, deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.REJECTED, deleted_at: null } }),
      this.prisma.topics.count(),
      this.prisma.teacher_quotas.count({ where: { status: TeacherQuotaStatus.INSUFFICIENT } }),
    ]);

    const departmentStats = await this.getDepartmentStats();
    const topRecentActivities = await this.getRecentActivities(5);

    return {
      overview: {
        students: totalStudents,
        teachers: totalTeachers,
        projects: totalProjects,
        departments: totalDepartments,
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
      departmentStats,
      recentActivities: topRecentActivities,
    };
  }

  async getSecretaryDashboard(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        faculty: true,
        secretary: {
          include: { user: true },
        },
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    if (!department) {
      throw new Error(`Department ${departmentId} not found`);
    }

    const teacherIds = department.teachers.map((t) => t.id);

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
      this.prisma.student.count({ where: { deleted_at: null } }),
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
      department: {
        id: department.id,
        name: department.name,
        faculty: department.faculty?.name || 'N/A',
      },
      summary: {
        totalStudents,
        totalTeachers: department.teachers.length,
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

  async getDepartmentStats() {
    const departments = await this.prisma.department.findMany({
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
        faculty: {
          select: { name: true },
        },
        secretary: {
          include: { user: { select: { username: true, email: true } } },
        },
      },
    });

    return Promise.all(
      departments.map(async (dept) => {
        const [projectCount, topicCount] = await Promise.all([
          this.prisma.project.count({
            where: {
              teacher_id: { in: dept.teachers.map((t) => t.id) },
              deleted_at: null,
            },
          }),
          this.prisma.topics.count({
            where: {
              teacher_id: { in: dept.teachers.map((t) => t.id) },
            },
          }),
        ]);

        return {
          id: dept.id,
          name: dept.name,
          faculty: dept.faculty?.name || 'N/A',
          secretary: dept.secretary ? dept.secretary.user?.username : 'Chưa gán',
          teachers: dept.teachers.length,
          projects: projectCount,
          topics: topicCount,
        };
      }),
    );
  }

  async getSecretaryDepartmentId(userId: number): Promise<string | null> {
    const secretary = await this.prisma.secretary.findUnique({
      where: { user_id: userId },
      include: { department: { select: { id: true } } },
    });
    return secretary?.department?.id || null;
  }

  async getSecretaryDepartmentDetails(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
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

    if (!department) {
      throw new Error(`Department ${departmentId} not found`);
    }

    return {
      department: {
        id: department.id,
        name: department.name,
      },
      teachers: department.teachers.map((teacher) => {
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

  async getDepartmentStatsWithProjectCounts() {
    const departments = await this.prisma.department.findMany({
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    return Promise.all(
      departments.map(async (dept) => {
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
          department_id: dept.id,
          department_name: dept.name,
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

  async getDepartmentListScoped(user: any) {
    const role = user?.role || 'USER';

    if (role === 'ADMIN') {
      return this.getDepartmentStatsWithProjectCounts();
    }

    if (role === 'SECRETARY') {
      try {
        const userId = Number(user.sub);
        if (isNaN(userId)) {
          console.warn('Invalid user ID format:', user.sub);
          return [];
        }
        const departmentId = await this.getSecretaryDepartmentId(userId);
        if (!departmentId) {
          console.warn('Secretary not assigned to any department, userId:', userId);
          return [];
        }
        const deptStats = await this.getDepartmentStatsWithProjectCounts();
        return deptStats.filter(d => d.department_id === departmentId);
      } catch (error) {
        console.error('Error in getDepartmentListScoped for SECRETARY:', error);
        return [];
      }
    }

    throw new Error('Unauthorized');
  }

  async getDepartmentDetailScoped(departmentId: string, user: any) {
    const role = user.role || 'USER';

    if (role === 'SECRETARY') {
      const secretaryDeptId = await this.getSecretaryDepartmentId(user.sub);
      if (!secretaryDeptId || secretaryDeptId !== departmentId) {
        throw new Error('Forbidden');
      }
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      throw new Error('Department not found');
    }

    const teacherIds = await this.prisma.teacher.findMany({
      where: { department_id: departmentId, deleted_at: null },
      select: { id: true },
    });

    const teacherIdList = teacherIds.map(t => t.id);

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
      department_id: dept.id,
      department_name: dept.name,
      teachers: teacherIdList.length,
      projects: {
        total,
        pending,
        approved,
        rejected,
      },
    };
  }

  async getDepartmentProgressReportsScoped(departmentId: string, user: any) {
    const role = user.role || 'USER';

    if (role === 'SECRETARY') {
      const secretaryDeptId = await this.getSecretaryDepartmentId(user.sub);
      if (!secretaryDeptId || secretaryDeptId !== departmentId) {
        throw new Error('Forbidden');
      }
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      throw new Error('Department not found');
    }

    const teacherIds = await this.prisma.teacher.findMany({
      where: { department_id: departmentId, deleted_at: null },
      select: { id: true },
    });

    const teacherIdList = teacherIds.map(t => t.id);

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
      pending: reports.filter(r => r.status === 'PENDING').length,
      approved: reports.filter(r => r.status === 'APPROVED').length,
      rejected: reports.filter(r => r.status === 'REJECTED').length,
    };

    const grouped = new Map<string, Record<string, number>>();

    reports.forEach(report => {
      const key = `${report.year}-${String(report.month).padStart(2, '0')}`;
      if (!grouped.has(key)) {
        grouped.set(key, { pending: 0, approved: 0, rejected: 0, total: 0 });
      }
      const counts = grouped.get(key)!;
      counts[report.status.toLowerCase()] = (counts[report.status.toLowerCase()] || 0) + 1;
      counts.total += 1;
    });

    const series = Array.from(grouped.entries())
      .map(([key, counts]) => {
        const [year, month] = key.split('-');
        const monthNum = parseInt(month, 10);
        const monthNames = [
          'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
          'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
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
      department: {
        id: dept.id,
        name: dept.name,
      },
      summary,
      series,
    };
  }

  async getSecretaryDepartmentOverview(departmentId: string, user: any) {
    const role = user.role || 'USER';

    if (role === 'SECRETARY') {
      const secretaryDeptId = await this.getSecretaryDepartmentId(user.sub);
      if (!secretaryDeptId || secretaryDeptId !== departmentId) {
        throw new Error('Forbidden');
      }
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        faculty: { select: { name: true } },
        teachers: {
          where: { deleted_at: null },
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!dept) {
      throw new Error('Department not found');
    }

    const teacherIds = dept.teachers.map(t => t.id);

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
        where: { teacher_id: { in: teacherIds }, status: 'PENDING', deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: { teacher_id: { in: teacherIds }, status: 'APPROVED', deleted_at: null },
      }),
      this.prisma.progress_reports.count({
        where: { teacher_id: { in: teacherIds }, status: 'REJECTED', deleted_at: null },
      }),
    ]);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      include: {
        teacher: { select: { name: true, id: true } },
      },
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    return {
      department: {
        id: dept.id,
        name: dept.name,
        faculty: dept.faculty?.name,
        code: 'SE-IT',
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
      recentTopics: topics.map(t => ({
        id: t.id,
        name: t.name,
        code: t.id.substring(0, 8).toUpperCase(),
        teacher: {
          id: t.teacher.id,
          name: t.teacher.name,
        },
        status: t.status,
        completionPercentage: 100,
      })),
    };
  }

  async getSecretaryDepartmentTopics(departmentId: string, user: any) {
    const role = user.role || 'USER';

    if (role === 'SECRETARY') {
      const secretaryDeptId = await this.getSecretaryDepartmentId(user.sub);
      if (!secretaryDeptId || secretaryDeptId !== departmentId) {
        throw new Error('Forbidden');
      }
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true },
        },
      },
    });

    if (!dept) {
      throw new Error('Department not found');
    }

    const teacherIds = dept.teachers.map(t => t.id);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      total: topics.length,
      data: topics.map(t => ({
        id: t.id,
        name: t.name,
        code: t.id.substring(0, 8).toUpperCase(),
        teacher: {
          id: t.teacher.id,
          name: t.teacher.name,
          email: t.teacher.email,
        },
        status: t.status,
        completionPercentage: t.status === 'APPROVED' ? 100 : t.status === 'PENDING' ? 50 : 0,
        createdAt: t.created_at,
      })),
    };
  }

  async getDepartmentSecretaryDetail(departmentId: string, user: any) {
    const role = user.role || 'USER';

    if (role === 'SECRETARY') {
      const secretaryDeptId = await this.getSecretaryDepartmentId(user.sub);
      if (!secretaryDeptId || secretaryDeptId !== departmentId) {
        throw new Error('Forbidden');
      }
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        teachers: {
          where: { deleted_at: null },
          select: { id: true, name: true, email: true, position: true },
        },
      },
    });

    if (!dept) {
      throw new Error('Department not found');
    }

    const teacherIds = dept.teachers.map(t => t.id);

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
        where: { teacher_id: { in: teacherIds }, status: 'PENDING', deleted_at: null },
      }),
    ]);

    const topics = await this.prisma.topics.findMany({
      where: { teacher_id: { in: teacherIds } },
      include: {
        teacher: { select: { id: true, name: true, email: true, position: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: 'SE-IT',
      totalTeachers: dept.teachers.length,
      totalTopics: completedTopics + pendingTopics + delayedTopics,
      completedTopics,
      pendingApprovalTopics: pendingTopics,
      delayedTopics,
      totalReports,
      pendingApprovals: pendingReports,
      topics: topics.map(t => ({
        id: t.id,
        name: t.name,
        code: t.id.substring(0, 8).toUpperCase(),
        instructorName: t.teacher.name,
        instructorRole: t.teacher.position || 'Giảng viên bộ môn',
        completionPercentage: t.status === 'APPROVED' ? 100 : t.status === 'PENDING' ? 50 : 0,
        status: t.status === 'APPROVED' ? 'completed' : t.status === 'PENDING' ? 'pending' : 'delayed',
      })),
    };
  }
}
