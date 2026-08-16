import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExcelModule } from '@/shared/utils';
import { TeacherModule } from '@/modules/teacher/teacher.module';
import { RegistrationPeriodModule } from '@/modules/registration-period/registration-period.module';

import { StudentModule } from '@/modules';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    ExcelModule,
    TeacherModule,
    StudentModule,
    RegistrationPeriodModule,
  ],
})
export class AppModule {}
