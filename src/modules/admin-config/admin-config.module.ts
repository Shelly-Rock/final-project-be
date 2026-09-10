import { Module } from '@nestjs/common';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AlertDispatchService } from './alert-dispatch.service';
import { GovernanceSchedulerService } from './governance-scheduler.service';

@Module({
  controllers: [AdminConfigController],
  providers: [
    AdminConfigService,
    AlertDispatchService,
    GovernanceSchedulerService,
  ],
  exports: [AdminConfigService, AlertDispatchService],
})
export class AdminConfigModule {}
