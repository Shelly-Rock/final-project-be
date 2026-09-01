import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoreAuthModule } from './core/auth/auth.module';
import { ExcelModule } from '@/shared/utils';
import { TeacherModule } from '@/modules/teacher/teacher.module';
import { RegistrationPeriodModule } from '@/modules/registration-period/registration-period.module';
import { ProgressTrackingModule } from './modules/progress-tracking';
import { SubmissionModule } from './modules/submission/submission.module';
import { CommitteeModule } from './modules/committee/committee.module';
import { DefenseModule } from './modules/defense/defense.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { JwtAuthGuard } from './core/auth/guards/jwtAuth.guard';

import { StudentModule } from '@/modules';
import { RoleModule } from '@/modules/role';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CoreAuthModule,
    AuthModule,
    ExcelModule,
    TeacherModule,
    StudentModule,
    RoleModule,
    RegistrationPeriodModule,
    ProgressTrackingModule,
    SubmissionModule,
    CommitteeModule,
    DefenseModule,
    ScoringModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
