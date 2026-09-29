import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
    const facultyId =
      await this.dashboardService.getSecretaryFacultyId(userId);
    if (!facultyId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    return this.dashboardService.getSecretaryDashboard(facultyId);
  }

  @Get('secretary/faculty-details')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Chi tiết khoa cho thư ký' })
  @ApiOkResponse({ description: 'Chi tiết về giáo viên và dự án' })
  async getSecretaryFacultyDetails(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const facultyId =
      await this.dashboardService.getSecretaryFacultyId(userId);
    if (!facultyId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    return this.dashboardService.getSecretaryFacultyDetails(facultyId);
  }

  @Get('admin/faculties')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Thống kê tổng hợp theo khoa' })
  @ApiOkResponse({ description: 'Số liệu tổng hợp theo khoa' })
  async getAdminFaculties() {
    return this.dashboardService.getFacultyStats();
  }

  @Get('admin/faculties/:facultyId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Chi tiết một khoa' })
  @ApiOkResponse({ description: 'Thông tin và số liệu của khoa' })
  async getAdminFacultyDetail(@Param('facultyId') facultyId: string) {
    return this.dashboardService.getFacultyDetail(facultyId);
  }

  @Get('faculty')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Danh sách khoa theo phạm vi quyền' })
  @ApiOkResponse({
    description: 'Admin: tất cả khoa; Secretary: khoa được gán',
  })
  async getFacultyList(@CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getFacultyListScoped(user);
    return { data };
  }

  @Get('faculty/:id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Chi tiết một khoa' })
  @ApiOkResponse({ description: 'Thống kê khoa, quyền truy cập theo role' })
  async getFacultyDetail(
    @Param('id') facultyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.dashboardService.getFacultyDetailScoped(
      facultyId,
      user,
    );
    return { data };
  }

  @Get('faculty/:id/progress-reports')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Thống kê báo cáo tiến trình của khoa theo tháng' })
  @ApiOkResponse({ description: 'Dữ liệu grouped column chart báo cáo' })
  async getFacultyProgressReports(
    @Param('id') facultyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.dashboardService.getFacultyProgressReportsScoped(
      facultyId,
      user,
    );
    return { data };
  }

  @Get('secretary/faculty-overview')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Tổng quan khoa cho thư ký (chi tiết dashboard)' })
  @ApiOkResponse({ description: 'Tổng quan đầy đủ khoa với thống kê' })
  async getSecretaryFacultyOverview(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const facultyId =
      await this.dashboardService.getSecretaryFacultyId(userId);
    if (!facultyId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    const data = await this.dashboardService.getSecretaryFacultyOverview(
      facultyId,
      user,
    );
    return { data };
  }

  @Get('secretary/faculty-topics')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Danh sách đề tài của khoa cho thư ký' })
  @ApiOkResponse({ description: 'Danh sách tất cả đề tài trong khoa' })
  async getSecretaryFacultyTopics(@CurrentUser() user: JwtUser) {
    const userId = Number(user.sub);
    const facultyId =
      await this.dashboardService.getSecretaryFacultyId(userId);
    if (!facultyId) {
      return { error: 'Thư ký chưa được gán khoa' };
    }
    const data = await this.dashboardService.getSecretaryFacultyTopics(
      facultyId,
      user,
    );
    return { data };
  }

  @Get('secretary/faculty-actions')
  @Roles('SECRETARY')
  @ApiOperation({ summary: 'Việc cần xử lý của khoa dành cho thư ký' })
  async getSecretaryFacultyActions(@CurrentUser() user: JwtUser) {
    const facultyId = await this.dashboardService.getSecretaryFacultyId(Number(user.sub));
    if (!facultyId) return { error: 'Thư ký chưa được gán khoa' };
    const data = await this.dashboardService.getSecretaryFacultyActions(facultyId, user);
    return { data };
  }

  @Get('faculty/:id/secretary-detail')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Chi tiết khoa cho thư ký với đề tài' })
  @ApiOkResponse({
    description: 'Thông tin chi tiết khoa, giảng viên, và danh sách đề tài',
  })
  async getFacultySecretaryDetail(
    @Param('id') facultyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.dashboardService.getFacultySecretaryDetail(
      facultyId,
      user,
    );
    return { data };
  }
}
