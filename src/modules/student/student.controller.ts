import {
  HttpCode,
  HttpStatus,
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';

import { StudentService } from './student.service';

import { FileInterceptor } from '@nestjs/platform-express';

import type { MulterFile } from '../../shared/types/multer-file.type';
import type { Response } from 'express';

import { PaginationReqDTO } from '@/shared';
import {
  CreateStudentReqDTO,
  UpdateStudentReqDTO,
  GetListStudentRespDTO,
} from './dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@ApiTags('Students')
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import danh sách sinh viên từ file Excel',
  })
  @ApiBody({
    description: 'File Excel chứa danh sách sinh viên',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Import danh sách sinh viên thành công',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(@UploadedFile() file: MulterFile) {
    return this.studentService.importStudents(file);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xuất danh sách sinh viên ra file Excel',
  })
  @ApiOkResponse({
    description: 'Xuất danh sách sinh viên thành công',
  })
  async exportStudents(@Res() response: Response) {
    const file = await this.studentService.exportStudents();
    response.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="danh_sach_sinh_vien.xlsx"',
    });
    response.send(file);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách sinh viên',
  })
  @ApiOkResponse({
    description: 'Lấy danh sách sinh viên thành công',
  })
  async getListStudents(@Query() query: PaginationReqDTO) {
    return this.studentService.getListStudents(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy chi tiết sinh viên theo ID',
  })
  @ApiParam({ name: 'id', description: 'ID của sinh viên', type: Number })
  @ApiOkResponse({
    description: 'Lấy chi tiết sinh viên thành công',
    type: GetListStudentRespDTO,
  })
  async getStudentById(@Param('id', ParseIntPipe) id: number) {
    return this.studentService.getStudentById(id);
  }

  @Get('code/:studentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy chi tiết sinh viên theo mã sinh viên',
  })
  @ApiParam({ name: 'studentId', description: 'Mã sinh viên', type: String })
  @ApiOkResponse({
    description: 'Lấy chi tiết sinh viên thành công',
    type: GetListStudentRespDTO,
  })
  async getStudentByStudentId(@Param('studentId') studentId: string) {
    return this.studentService.getStudentByStudentId(studentId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo mới một sinh viên',
  })
  @ApiCreatedResponse({
    description: 'Tạo sinh viên thành công',
  })
  async createStudent(@Body() dto: CreateStudentReqDTO) {
    return this.studentService.createStudent(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật thông tin sinh viên',
  })
  @ApiParam({ name: 'id', description: 'ID của sinh viên', type: Number })
  @ApiOkResponse({
    description: 'Cập nhật sinh viên thành công',
  })
  async updateStudent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentReqDTO,
  ) {
    return this.studentService.updateStudent(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa sinh viên (soft delete hoặc hard delete)',
  })
  @ApiParam({ name: 'id', description: 'ID của sinh viên', type: Number })
  @ApiOkResponse({
    description: 'Xóa sinh viên thành công',
  })
  async removeStudent(
    @Param('id', ParseIntPipe) id: number,
    @Query('hardDelete') hardDelete?: string,
  ) {
    const isHardDelete = hardDelete === 'true' || hardDelete === '1';
    return this.studentService.removeStudent(id, isHardDelete);
  }
}
