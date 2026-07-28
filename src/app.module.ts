import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExcelModule } from '@/shared/utils';

import { StudentModule } from '@/modules';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, ExcelModule, StudentModule],
})
export class AppModule {}
