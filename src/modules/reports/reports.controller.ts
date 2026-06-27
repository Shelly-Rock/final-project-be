import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('users/export')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Export all users to Excel' })
  async exportAllUsers(@Res() res: any) {
    const buffer = await this.reportsService.exportAllUsers();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="danh_sach_nguoi_dung.xlsx"');
    res.send(buffer);
  }

  @Get('topics/export')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Export all topics to Excel' })
  async exportTopics(@Res() res: any, @Query() query: any) {
    const buffer = await this.reportsService.exportAllTopics(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="danh_sach_de_tai.xlsx"');
    res.send(buffer);
  }

  @Get('registrations/export')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Export registrations to Excel' })
  async exportRegistrations(@Res() res: any, @Query() query: any) {
    const buffer = await this.reportsService.exportRegistrations(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="danh_sach_dang_ky.xlsx"');
    res.send(buffer);
  }

  @Get('registrations/approved/export')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Export approved registrations with thesis codes' })
  async exportApprovedRegistrations(@Res() res: any) {
    const buffer = await this.reportsService.exportApprovedRegistrations();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="phieu_duyet_de_tai.xlsx"');
    res.send(buffer);
  }

  @Get('dashboard/stats')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }
}
