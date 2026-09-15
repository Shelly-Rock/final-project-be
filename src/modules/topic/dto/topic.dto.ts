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

  @ApiPropertyOptional({ example: 'CNTT' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  departmentCode?: string;

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

/** Một phần tử phân công nhiệm vụ cho 1 sinh viên trong nhóm */
export class StudentAssignmentDto {
  @ApiProperty({ description: 'Project ID của sinh viên (id của bản ghi Project)' })
  @IsInt()
  @Min(1)
  projectId: number;

  @ApiProperty({ description: 'Nhiệm vụ được giao cho sinh viên này' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  assignedTask: string;

  @ApiProperty({ description: 'Đánh dấu sinh viên này là trưởng nhóm' })
  @IsBoolean()
  isLeader: boolean;
}

/** DTO dùng khi GV khóa đề tài kèm phân công nhiệm vụ cho từng thành viên */
export class LockTopicWithAssignmentsDto {
  @ApiProperty({ type: [StudentAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => StudentAssignmentDto)
  assignments: StudentAssignmentDto[];
}
