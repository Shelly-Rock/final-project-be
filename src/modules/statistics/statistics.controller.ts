import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARY')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('academic')
  @ApiOperation({ summary: 'Báo cáo học vụ: tỷ lệ sinh viên đậu/rớt (Giai đoạn 8)' })
  @ApiQuery({ name: 'periodId', required: false, type: Number })
  @ApiOkResponse({ description: 'Thống kê đậu/rớt theo kỳ' })
  getAcademicReport(@Query('periodId') periodId?: string) {
    return this.statisticsService.getAcademicReport(
      periodId ? Number(periodId) : undefined,
    );
  }

  @Get('teacher-productivity')
  @ApiOperation({ summary: 'Báo cáo năng suất giảng viên (Giai đoạn 8)' })
  @ApiQuery({ name: 'periodId', required: false, type: Number })
  @ApiOkResponse({ description: 'Đề tài đã ra, ghế hội đồng theo vai trò, SV hướng dẫn' })
  getTeacherProductivity(@Query('periodId') periodId?: string) {
    return this.statisticsService.getTeacherProductivity(
      periodId ? Number(periodId) : undefined,
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất toàn bộ số liệu thống kê ra Excel (Giai đoạn 8)' })
  @ApiQuery({ name: 'periodId', required: false, type: Number })
  @ApiOkResponse({ description: 'File .xlsx gồm 2 sheet học vụ và năng suất giảng viên' })
  async exportStatistics(@Res() response: Response, @Query('periodId') periodId?: string) {
    const file = await this.statisticsService.exportStatistics(
      periodId ? Number(periodId) : undefined,
    );
    response.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="thong_ke_giai_doan_8.xlsx"',
    });
    response.send(file);
  }
}
