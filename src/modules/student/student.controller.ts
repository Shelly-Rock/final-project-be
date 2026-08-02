import {
  BadRequestException,
  HttpCode,
  HttpStatus,
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { StudentService } from './student.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterFile } from '../../shared/types/multer-file.type';

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
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file Excel.');
    }

    return this.studentService.importStudents(file);
  }
}
