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
}
