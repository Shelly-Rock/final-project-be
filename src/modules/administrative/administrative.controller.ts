import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AdministrativeService } from './administrative.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { FacultyResponseDto } from './dto/faculty.response.dto';
import { DepartmentResponseDto } from './dto/department.response.dto';

@ApiTags('Administrative')
@UseGuards(JwtAuthGuard)
@Controller('administrative')
export class AdministrativeController {
  constructor(private readonly adminService: AdministrativeService) {}

  @Get('faculties')
  @ApiOperation({ summary: 'Lấy danh sách khoa' })
  @ApiOkResponse({ type: [FacultyResponseDto] })
  async getFaculties() {
    return this.adminService.getFaculties();
  }

  @Get('departments')
  @ApiOperation({ summary: 'Lấy danh sách bộ môn (có thể lọc theo khoa)' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  async getDepartments(@Query('facultyId') facultyId?: string) {
    return this.adminService.getDepartments(facultyId);
  }
}
