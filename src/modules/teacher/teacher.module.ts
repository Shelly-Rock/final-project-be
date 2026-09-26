import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { PrismaModule } from '@/core/database/prisma/prisma.module';
import { ExcelModule } from '@/shared/utils';
import { AuthModule } from '@/modules/auth/auth.module';
import { CreateTeacherService, ImportTeacherService } from './services';

@Module({
  imports: [PrismaModule, ExcelModule, AuthModule],
  controllers: [TeacherController],
  providers: [TeacherService, CreateTeacherService, ImportTeacherService],
  exports: [TeacherService, CreateTeacherService, ImportTeacherService],
})
export class TeacherModule {}
