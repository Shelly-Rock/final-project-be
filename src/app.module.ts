import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import {ExcelModule} from "@/shared/utils";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule,ExcelModule],
})
export class AppModule {}
