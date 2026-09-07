import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListTeacherOverridesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;

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
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpsertTeacherOverridesDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  teacherIds: number[];

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  assignedQuota: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  maxStudentsPerTopic?: number;
}

export class DeleteTeacherOverrideQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;
}
