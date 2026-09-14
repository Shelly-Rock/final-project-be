import { Controller, Get, UseGuards } from '@nestjs/common';
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
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(user.sub);
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
    const departmentId = await this.dashboardService.getSecretaryDepartmentId(user.sub);
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
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Thống kê tất cả các khoa' })
  @ApiOkResponse({ description: 'Danh sách khoa với số giảng viên và đề tài' })
  async getDepartmentStats() {
    const data = await this.dashboardService.getDepartmentStatsWithProjectCounts();
    return { data };
  }
}
