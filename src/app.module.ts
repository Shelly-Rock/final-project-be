import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { PrismaModule } from '@core/database/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
})
export class AppModule {}
