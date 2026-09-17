import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { JwtAuthGuard } from './core/auth/guards/jwtAuth.guard';
import { PermissionsGuard } from './core/auth/guards/permissions.guard';
import { RolesGuard } from './core/auth/guards/roles.guard';

import { StudentModule } from '@/modules';
import { RoleModule } from '@/modules/role';
import { UserModule } from '@/modules/user';
import { PermissionModule } from '@/modules/permission/permission.module';
import { GovernanceModule } from '@/modules/governance/governance.module';
import { AdminConfigModule } from '@/modules/admin-config/admin-config.module';
import { TopicModule } from '@/modules/topic/topic.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { StatisticsModule } from '@/modules/statistics/statistics.module';
import { AdministrativeModule } from '@/modules/administrative/administrative.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    PrismaModule,
    AuditModule,
    DashboardModule,
    StatisticsModule,
    CoreAuthModule,
    AuthModule,
    ExcelModule,
    AdministrativeModule,
    TeacherModule,
    StudentModule,
    UserModule,
    RoleModule,
    PermissionModule,
    GovernanceModule,
    AdminConfigModule,
    TopicModule,
    RegistrationPeriodModule,
    ProgressTrackingModule,
    SubmissionModule,
    CommitteeModule,
    DefenseModule,
    ScoringModule,
    ChatModule,
    NotificationModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
