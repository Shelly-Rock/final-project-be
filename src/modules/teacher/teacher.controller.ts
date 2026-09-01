import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import {
  CreateTeacherDto,
  UpdateTeacherDto,
  ListTeacherQueryDto,
  ToggleTeacherStatusDto,
  TeacherResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@ApiTags('Teachers')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('next-code')
  @ApiOperation({ summary: 'Lấy mã giảng viên tự động tiếp theo' })
  async getNextCode() {
    return this.teacherService.generateNextLecturerCode();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới giảng viên' })
  @ApiCreatedResponse({ type: TeacherResponseDto })
  async create(@Body() createTeacherDto: CreateTeacherDto) {
    const teacher = await this.teacherService.create(createTeacherDto);
    return new TeacherResponseDto(teacher);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách giảng viên (có phân trang & tìm kiếm)',
  })
  findAll(@Query() query: ListTeacherQueryDto) {
    return this.teacherService.findAll(query);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Lấy chi tiết giảng viên' })
  @ApiOkResponse({ type: TeacherResponseDto })
  async findOne(@Param('code') code: string) {
    const teacher = await this.teacherService.findOne(code);
    return new TeacherResponseDto(teacher);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Cập nhật thông tin giảng viên' })
  @ApiOkResponse({ type: TeacherResponseDto })
  async update(
    @Param('code') code: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    const teacher = await this.teacherService.update(code, updateTeacherDto);
    return new TeacherResponseDto(teacher);
  }

  @Patch(':code/toggle-status') //[cite: 3]
  @ApiOperation({ summary: 'Bật/Tắt trạng thái hoạt động của giảng viên' })
  @ApiOkResponse({ type: TeacherResponseDto })
  async toggleStatus(
    @Param('code') code: string,
    @Body() dto: ToggleTeacherStatusDto,
  ) {
    const teacher = await this.teacherService.toggleStatus(code, dto.status);
    return new TeacherResponseDto(teacher);
  }

  @Delete(':code') //[cite: 3]
  @ApiOperation({ summary: 'Xóa (Soft delete) giảng viên' })
  async remove(@Param('code') code: string) {
    //[cite: 3]
    const teacher = await this.teacherService.remove(code);
    return new TeacherResponseDto(teacher);
  }
}
