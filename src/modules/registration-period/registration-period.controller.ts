import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RegistrationPeriodService } from './registration-period.service';
import {
  CreateRegistrationPeriodDto,
  UpdateTeacherQuotaDto,
  UpdateRegistrationPeriodDto,
} from './dto';
import { RegistrationPeriodStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';

@ApiTags('Registration Periods')
// READ (danh sách/chi tiết) mở cho mọi role đã đăng nhập — GV/SV cần chọn đợt.
// Mọi mutation quản trị đều @Roles('ADMIN','SECRETARY').
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('registration-periods')
export class RegistrationPeriodController {
  constructor(private readonly periodService: RegistrationPeriodService) {}

  // --- CRUD CƠ BẢN ---

  @Post()
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Tạo đợt đăng ký mới' })
  create(@Body() createDto: CreateRegistrationPeriodDto) {
    return this.periodService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đợt đăng ký (có lọc/tìm kiếm)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm theo tên đợt',
  })
  @ApiQuery({
    name: 'semester',
    required: false,
    description: 'Học kỳ (1, 2, 3)',
  })
  @ApiQuery({
    name: 'schoolYear',
    required: false,
    description: 'Năm học (VD: 2025-2026)',
  })
  @ApiQuery({ name: 'status', enum: RegistrationPeriodStatus, required: false })
  findAll(
    @Query('search') search?: string,
    @Query('semester') semester?: string,
    @Query('schoolYear') schoolYear?: string,
    @Query('status') status?: RegistrationPeriodStatus,
  ) {
    return this.periodService.findAll(search, semester, schoolYear, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết đợt đăng ký' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Cập nhật thông tin đợt đăng ký' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRegistrationPeriodDto,
  ) {
    return this.periodService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Xóa đợt đăng ký (Xóa luôn cả chỉ tiêu & đề tài)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.remove(id);
  }

  // --- ĐIỀU KHIỂN TRẠNG THÁI ---

  @Post(':id/open')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Mở đợt đăng ký' })
  openPeriod(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.openPeriod(id);
  }

  @Post(':id/close')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Đóng đợt đăng ký' })
  closePeriod(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.closePeriod(id);
  }

  // --- QUẢN LÝ CHỈ TIÊU (QUOTAS) ---

  @Get(':id/teacher-quotas')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Lấy danh sách chỉ tiêu giảng viên theo đợt' })
  getTeacherQuotas(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.getTeacherQuotas(id);
  }

  @Put(':id/teacher-quotas/:teacherId')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Cập nhật chỉ tiêu cho 1 giảng viên' })
  updateTeacherQuota(
    @Param('id', ParseIntPipe) id: number,
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Body() dto: UpdateTeacherQuotaDto,
  ) {
    return this.periodService.updateTeacherQuota(id, teacherId, dto);
  }

  @Post(':id/notify-teachers')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Gửi nhắc nhở cho GV chưa đủ chỉ tiêu' })
  notifyTeachers(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.notifyInsufficientTeachers(id);
  }

  // --- THỐNG KÊ ---

  @Get(':id/stats')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Lấy thống kê (số lượng đề tài, chỉ tiêu...)' })
  getPeriodStats(@Param('id', ParseIntPipe) id: number) {
    return this.periodService.getPeriodStats(id);
  }
}
