import { Module } from '@nestjs/common';
import { ThesisTopicsController } from './thesis-topics.controller';
import { ThesisTopicsService } from './thesis-topics.service';
import { ExcelModule } from '../excel/excel.module';

@Module({
  controllers: [ThesisTopicsController],
  providers: [ThesisTopicsService],
  exports: [ThesisTopicsService],
  imports: [ExcelModule],
})
export class ThesisTopicsModule {}
