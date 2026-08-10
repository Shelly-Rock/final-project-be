import {
  HttpCode,
  HttpStatus,
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

import { StudentService } from './student.service';

import { FileInterceptor } from '@nestjs/platform-express';

import type { MulterFile } from '../../shared/types/multer-file.type';

import { PaginationReqDTO } from '@/shared';

@ApiTags('Students')
@Controller('students')
// @ApiBearerAuth()
export class StudentController {
  constructor(private readonly studentService: StudentService) {}
  // endpoin controller
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  // Swagger doc
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

  // call service
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(@UploadedFile() file: MulterFile) {
    return this.studentService.importStudents(file);
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
}
