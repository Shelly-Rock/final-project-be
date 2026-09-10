import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { ProjectStatus, ReportStatus } from '@prisma/client';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARY')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('secretary')
  @ApiOperation({ summary: 'Thống kê tổng quan cho thư ký' })
  @ApiOkResponse({ description: 'Thống kê tổng quan' })
  async getSecretaryDashboard() {
    const [
      totalStudents,
      totalTeachers,
      totalProjects,
      pendingReports,
      approvedReports,
      rejectedReports,
      pendingProjects,
      approvedProjects,
      rejectedProjects,
      totalUsers,
    ] = await Promise.all([
      this.prisma.student.count({ where: { deleted_at: null } }),
      this.prisma.teacher.count({ where: { deleted_at: null } }),
      this.prisma.project.count({ where: { deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.PENDING, deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.APPROVED, deleted_at: null } }),
      this.prisma.progress_reports.count({ where: { status: ReportStatus.REJECTED, deleted_at: null } }),
      this.prisma.project.count({ where: { status: ProjectStatus.PENDING, deleted_at: null } }),
      this.prisma.project.count({ where: { status: ProjectStatus.APPROVED, deleted_at: null } }),
      this.prisma.project.count({ where: { status: ProjectStatus.REJECTED, deleted_at: null } }),
      this.prisma.user.count({ where: { deleted_at: null } }),
    ]);

    return {
      students: totalStudents,
      teachers: totalTeachers,
      projects: totalProjects,
      users: totalUsers,
      reports: {
        pending: pendingReports,
        approved: approvedReports,
        rejected: rejectedReports,
        total: pendingReports + approvedReports + rejectedReports,
      },
      projectStatus: {
        pending: pendingProjects,
        approved: approvedProjects,
        rejected: rejectedProjects,
      },
    };
  }

  @Get('department')
  @ApiOperation({ summary: 'Thống kê theo khoa/bộ môn' })
  @ApiOkResponse({ description: 'Thống kê theo khoa/bộ môn' })
  async getDepartmentDashboard() {
    const departments = await this.prisma.department.findMany({
      include: {
        teachers: {
          where: { deleted_at: null },
          select: {
            id: true,
            project: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    return departments.map((dept) => {
      const teacherIds = dept.teachers.map((t) => t.id);
      const projects = dept.teachers.flatMap((t) => t.project);
      const pendingProjects = projects.filter((p) => p.status === ProjectStatus.PENDING).length;
      const approvedProjects = projects.filter((p) => p.status === ProjectStatus.APPROVED).length;
      const rejectedProjects = projects.filter((p) => p.status === ProjectStatus.REJECTED).length;

      return {
        department_id: dept.id,
        department_name: dept.name,
        teachers: teacherIds.length,
        projects: {
          total: projects.length,
          pending: pendingProjects,
          approved: approvedProjects,
          rejected: rejectedProjects,
        },
      };
    });
  }
}
