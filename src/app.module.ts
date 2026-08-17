import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExcelModule } from '@/shared/utils';
import { TeacherModule } from '@/modules/teacher/teacher.module';
import { ProgressTrackingModule } from './modules/progress-tracking';
import { SubmissionModule } from './modules/submission/submission.module';
import { CommitteeModule } from './modules/committee/committee.module';
import { DefenseModule } from './modules/defense/defense.module';
import { ScoringModule } from './modules/scoring/scoring.module';

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
    SubmissionModule,
    CommitteeModule,
    DefenseModule,
    ScoringModule,
  ],
})
export class AppModule {}
