import { Module } from '@nestjs/common';
import { DeadlineSettingsController } from './deadline-settings.controller';
import { DeadlineSettingsService } from './deadline-settings.service';

@Module({
  controllers: [DeadlineSettingsController],
  providers: [DeadlineSettingsService],
  exports: [DeadlineSettingsService],
})
export class DeadlineSettingsModule {}
