import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { MajorsModule } from './modules/majors/majors.module';
import { ClassesModule } from './modules/classes/classes.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ThesisTopicsModule } from './modules/thesis-topics/thesis-topics.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ExcelModule } from './modules/excel/excel.module';
import { DeadlineSettingsModule } from './modules/deadline-settings/deadline-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
    PrismaModule,
    ExcelModule,
    AuthModule,
    UsersModule,
    HealthModule,
    DepartmentsModule,
    MajorsModule,
    ClassesModule,
    CoursesModule,
    ThesisTopicsModule,
    RegistrationsModule,
    ReportsModule,
    DeadlineSettingsModule,
  ],
})
export class AppModule {}
