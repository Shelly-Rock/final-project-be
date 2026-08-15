import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExcelModule } from '@/shared/utils';
import { TeacherModule } from '@/modules/teacher/teacher.module';
import { ProgressTrackingModule } from './modules/progress-tracking';

import { StudentModule } from '@/modules';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    ExcelModule,
    TeacherModule,
    StudentModule,
    ProgressTrackingModule,
  ],
})
export class AppModule {}
