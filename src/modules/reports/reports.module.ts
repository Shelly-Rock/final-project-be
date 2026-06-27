import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExcelModule } from '../excel/excel.module';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
  imports: [ExcelModule],
})
export class ReportsModule {}
