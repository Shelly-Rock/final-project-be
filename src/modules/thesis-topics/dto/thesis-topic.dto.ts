import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsDate,
  IsEnum,
  IsArray,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TopicStatus } from '@prisma/client';

export class CreateThesisTopicDto {
  @ApiProperty({ example: 'Nghiên cứu về AI trong giáo dục', description: 'Topic title' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'Mô tả chi tiết về đề tài...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Sinh viên năm 3 trở lên, có kiến thức về ML' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requirements?: string;

  @ApiPropertyOptional({ example: 2, description: 'Max students can register (default 1)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxStudents?: number;

  @ApiPropertyOptional({ example: 7.5, description: 'Minimum GPA requirement' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minGpa?: number;

  @ApiPropertyOptional({ description: 'Allow multiple order choices' })
  @IsOptional()
  @IsBoolean()
  isMultipleOrder?: boolean;

  @ApiPropertyOptional({ example: 'uuid-major-id' })
  @IsOptional()
  @IsUUID()
  majorId?: string;

  @ApiPropertyOptional({ example: '2025-06-30', description: 'Registration deadline' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;

  @ApiPropertyOptional({ example: 'uuid-supervisor-id' })
  @IsUUID()
  supervisorId: string;
}

export class UpdateThesisTopicDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxStudents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minGpa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMultipleOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  majorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(TopicStatus)
  status?: TopicStatus;
}

export class AssignSupervisorDto {
  @ApiProperty({ example: 'uuid-supervisor-id', description: 'Teacher ID to assign' })
  @IsUUID()
  supervisorId: string;

  @ApiPropertyOptional({ example: 5, description: 'Max topics for this teacher (default: 3, max: 10)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTopics?: number;
}

export class BulkAssignTopicsDto {
  @ApiProperty({
    example: [
      { topicId: 'uuid-topic-1', supervisorId: 'uuid-teacher-1' },
      { topicId: 'uuid-topic-2', supervisorId: 'uuid-teacher-2' },
    ],
  })
  @IsArray()
  assignments: Array<{ topicId: string; supervisorId: string }>;
}

export class SetDeadlineDto {
  @ApiProperty({ example: '2025-06-30T23:59:59Z' })
  @Type(() => Date)
  @IsDate()
  deadline: Date;

  @ApiPropertyOptional({ example: 'Đăng ký đề tài HK2 2024-2025' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class ApproveTopicDto {
  @ApiPropertyOptional({ example: 'Đề tài đạt yêu cầu' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectTopicDto {
  @ApiProperty({ example: 'Đề tài không phù hợp với chuyên ngành' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ThesisTopicQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TopicStatus })
  @IsOptional()
  @IsEnum(TopicStatus)
  status?: TopicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  majorId?: string;
}
