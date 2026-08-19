import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PrismaModule } from '@/core/database/prisma/prisma.module';
import { ExcelModule } from '@/shared/utils';
import { AuthModule } from '@/modules/auth/auth.module';
import {
  ImportStudentService,
  CreateStudentService,
  GetStudentListService,
  GetStudentByIdService,
  UpdateStudentService,
  RemoveStudentService,
} from './services';

@Module({
  imports: [PrismaModule, ExcelModule, AuthModule],
  controllers: [StudentController],
  providers: [
    StudentService,
    CreateStudentService,
    ImportStudentService,
    GetStudentListService,
    GetStudentByIdService,
    UpdateStudentService,
    RemoveStudentService,
  ],
  exports: [
    StudentService,
    CreateStudentService,
    ImportStudentService,
    GetStudentListService,
    GetStudentByIdService,
    UpdateStudentService,
    RemoveStudentService,
  ],
})
export class StudentModule {}
