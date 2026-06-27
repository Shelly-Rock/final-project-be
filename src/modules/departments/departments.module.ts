import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { ExcelModule } from '../excel/excel.module';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
  imports: [ExcelModule],
})
export class DepartmentsModule {}
