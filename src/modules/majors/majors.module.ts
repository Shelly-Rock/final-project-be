import { Module } from '@nestjs/common';
import { MajorsController } from './majors.controller';
import { MajorsService } from './majors.service';
import { ExcelModule } from '../excel/excel.module';

@Module({
  controllers: [MajorsController],
  providers: [MajorsService],
  exports: [MajorsService],
  imports: [ExcelModule],
})
export class MajorsModule {}
