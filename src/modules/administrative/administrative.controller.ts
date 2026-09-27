import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdministrativeService } from './administrative.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
import { FacultyResponseDto } from './dto/faculty.response.dto';
import { DepartmentResponseDto } from './dto/department.response.dto';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';

@ApiTags('Administrative')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('administrative')
export class AdministrativeController {
  constructor(private readonly adminService: AdministrativeService) {}

  @Get('faculties')
  @ApiOperation({ summary: 'Lấy danh sách khoa' })
  @ApiOkResponse({ type: [FacultyResponseDto] })
  async getFaculties(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.adminService.getFaculties(search, isActive);
  }

  @Get('faculties/:id')
  @ApiOperation({ summary: 'Lấy chi tiết khoa' })
  @ApiOkResponse({ type: FacultyResponseDto })
  async getFaculty(@Param('id') id: string) {
    return this.adminService.getFacultyById(id);
  }

  @Post('faculties')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Tạo khoa mới' })
  @ApiCreatedResponse({ type: FacultyResponseDto })
  async createFaculty(@Body() dto: CreateFacultyDto) {
    return this.adminService.createFaculty(dto);
  }

  @Patch('faculties/:id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Cập nhật khoa' })
  @ApiOkResponse({ type: FacultyResponseDto })
  async updateFaculty(
    @Param('id') id: string,
    @Body() dto: UpdateFacultyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.updateFaculty(id, dto, user);
  }

  @Delete('faculties/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Xóa khoa' })
  @ApiOkResponse({ description: 'Đã xóa khoa' })
  async deleteFaculty(@Param('id') id: string) {
    return this.adminService.deleteFaculty(id);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Lấy danh sách bộ môn (có thể lọc theo khoa)' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  async getDepartments(@Query('facultyId') facultyId?: string) {
    return this.adminService.getDepartments(facultyId);
  }
}
