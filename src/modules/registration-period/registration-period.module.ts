import { Module } from '@nestjs/common';
import { RegistrationPeriodService } from './registration-period.service';
import { RegistrationPeriodController } from './registration-period.controller';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { AdminConfigModule } from '@modules/admin-config/admin-config.module';

@Module({
  imports: [AdminConfigModule],
  controllers: [RegistrationPeriodController],
  providers: [RegistrationPeriodService, PrismaService],
  exports: [RegistrationPeriodService],
})
export class RegistrationPeriodModule {}
