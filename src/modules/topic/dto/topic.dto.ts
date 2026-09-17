import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus, TopicStatus } from '@prisma/client';

export class TopicManageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherId?: number;

  @IsOptional()
  @IsEnum(TopicStatus)
  status?: TopicStatus;

  @IsOptional()
  @IsEnum(ProjectStatus)
  registrationStatus?: ProjectStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSupplemental?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['code', 'name', 'teacher', 'status', 'createdAt'])
  sortBy: 'code' | 'name' | 'teacher' | 'status' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class CreateTopicDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  maxStudents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  englishName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technologies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isException?: boolean;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  preAssignedStudentIds?: number[];
}

export class UpdateTopicDto extends PartialType(CreateTopicDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}

export class ManualAssignDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  topicId: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  studentIds: number[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  reason: string;
}

export class ForceUpdateTopicDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  reason: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  maxStudents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  teacherId?: number;

  @ApiPropertyOptional({ enum: TopicStatus })
  @IsOptional()
  @IsEnum(TopicStatus)
  status?: TopicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}

export class GenerateTopicCodesDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  topicIds?: number[];

  @ApiPropertyOptional({ example: 'IT22.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  prefix?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overwrite = false;
}

export class BulkModerationDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  topicIds: number[];

  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  reason?: string;
}

export class CreateSupplementalTopicDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  teacherId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  maxStudents: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  studentIds: number[] = [];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  reason: string;
}

export class RegistrationDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}

export class SearchPeriodEntityQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class TopicAvailableQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
