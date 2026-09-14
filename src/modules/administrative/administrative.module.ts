import { Module } from '@nestjs/common';
import { AdministrativeService } from './administrative.service';
import { AdministrativeController } from './administrative.controller';
import { PrismaService } from '@/core/database/prisma/prisma.service';

@Module({
  controllers: [AdministrativeController],
  providers: [AdministrativeService, PrismaService],
  exports: [AdministrativeService],
})
export class AdministrativeModule {}
