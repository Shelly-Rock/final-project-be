// Submission Module - Stage 3
import { Module } from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { SubmissionCronService } from './submission.cron.service';

@Module({
  controllers: [SubmissionController],
  providers: [SubmissionService, SubmissionCronService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
