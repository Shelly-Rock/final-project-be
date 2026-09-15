import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Thống kê dashboard cho admin (quản lý 1-N khoa)' })
  @ApiOkResponse({ description: 'Thống kê tổng quan tất cả khoa' })
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('secretary')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Thống kê dashboard cho thư ký (quản lý 1 khoa)' })
  @ApiOkResponse({ description: 'Thống kê tổng quan khoa của thư ký' })
  async getSecretaryDashboard(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(userId);
    if (!departmentId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    return this.dashboardService.getSecretaryDashboard(departmentId);
  }

  @Get('secretary/department-details')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Chi tiết khoa cho thư ký' })
  @ApiOkResponse({ description: 'Chi tiết về giáo viên và dự án' })
  async getSecretaryDepartmentDetails(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(userId);
    if (!departmentId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    return this.dashboardService.getSecretaryDepartmentDetails(departmentId);
  }

  @Get('admin/departments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Danh sách các khoa với thống kê' })
  @ApiOkResponse({ description: 'Thống kê chi tiết từng khoa' })
  async getAdminDepartments() {
    return this.dashboardService.getDepartmentStats();
  }

  @Get('department')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Danh sách khoa theo phạm vi quyền' })
  @ApiOkResponse({ description: 'Admin: tất cả khoa; Secretary: khoa được gán' })
  async getDepartmentList(@CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getDepartmentListScoped(user);
    return { data };
  }

  @Get('department/:id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Chi tiết một khoa' })
  @ApiOkResponse({ description: 'Thống kê khoa, quyền truy cập theo role' })
  async getDepartmentDetail(@Param('id') departmentId: string, @CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getDepartmentDetailScoped(departmentId, user);
    return { data };
  }

  @Get('department/:id/progress-reports')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Thống kê báo cáo tiến trình của khoa theo tháng' })
  @ApiOkResponse({ description: 'Dữ liệu grouped column chart báo cáo' })
  async getDepartmentProgressReports(@Param('id') departmentId: string, @CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getDepartmentProgressReportsScoped(departmentId, user);
    return { data };
  }

  @Get('secretary/department-overview')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Tổng quan khoa cho thư ký (chi tiết dashboard)' })
  @ApiOkResponse({ description: 'Tổng quan đầy đủ khoa với thống kê' })
  async getSecretaryDepartmentOverview(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(userId);
    if (!departmentId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    const data = await this.dashboardService.getSecretaryDepartmentOverview(departmentId, user);
    return { data };
  }

  @Get('secretary/department-topics')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Danh sách đề tài của khoa cho thư ký' })
  @ApiOkResponse({ description: 'Danh sách tất cả đề tài trong khoa' })
  async getSecretaryDepartmentTopics(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(userId);
    if (!departmentId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    const data = await this.dashboardService.getSecretaryDepartmentTopics(departmentId, user);
    return { data };
  }

  @Get('department/:id/secretary-detail')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Chi tiết khoa cho thư ký với đề tài' })
  @ApiOkResponse({ description: 'Thông tin chi tiết khoa, giảng viên, và danh sách đề tài' })
  async getDepartmentSecretaryDetail(@Param('id') departmentId: string, @CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getDepartmentSecretaryDetail(departmentId, user);
    return { data };
  }
}
