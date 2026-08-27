import { Module } from '@nestjs/common';
import { MyTopicsService } from './my-topics.service';
import { MyTopicsController } from './my-topics.controller';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MyTopicsController],
  providers: [MyTopicsService, PrismaService],
  exports: [MyTopicsService],
})
export class MyTopicsModule {}