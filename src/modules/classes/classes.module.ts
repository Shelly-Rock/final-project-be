import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ExcelModule } from '../excel/excel.module';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
  imports: [ExcelModule],
})
export class ClassesModule {}
