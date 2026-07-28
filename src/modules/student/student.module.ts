import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PrismaModule } from '@/core/database/prisma/prisma.module';
import { ExcelModule } from '@/shared/utils';

@Module({
  imports: [PrismaModule, ExcelModule],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
