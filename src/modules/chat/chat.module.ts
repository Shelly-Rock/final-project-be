import { Module } from '@nestjs/common';
import { TopicModule } from '@modules/topic/topic.module';
import { ProgressTrackingModule } from '@modules/progress-tracking/progress-tracking.module';
import { SubmissionModule } from '@modules/submission/submission.module';
import { DefenseModule } from '@modules/defense/defense.module';
import { ScoringModule } from '@modules/scoring/scoring.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat.tools';

@Module({
  imports: [
    TopicModule,
    ProgressTrackingModule,
    SubmissionModule,
    DefenseModule,
    ScoringModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService],
})
export class ChatModule {}
