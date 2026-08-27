import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTopicDto } from './create-topic.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { TopicStatus } from '@prisma/client';

export class UpdateTopicDto extends PartialType(CreateTopicDto) {
  @ApiPropertyOptional({ 
    description: 'Cập nhật trạng thái đề tài (nếu cần)', 
    enum: TopicStatus 
  })
  @IsEnum(TopicStatus)
  @IsOptional()
  status?: TopicStatus;
}