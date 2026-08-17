// Committee DTOs
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max, IsArray, ValidateNested } from 'class-validator';

export enum CommitteeRole {
  CHAIRMAN = 'CHAIRMAN',
  SECRETARY = 'SECRETARY',
  INTERNAL_REVIEWER = 'INTERNAL_REVIEWER',
  EXTERNAL_REVIEWER = 'EXTERNAL_REVIEWER',
}

export enum CommitteeRoleLabel {
  CHAIRMAN = 'Chủ tịch',
  SECRETARY = 'Thư ký',
  INTERNAL_REVIEWER = 'Phản biện trong',
  EXTERNAL_REVIEWER = 'Phản biện ngoài',
}

export class CreateCommitteeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chairman_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  secretary_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  internal_1_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  internal_2_id?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  external_reviewer_ids?: number[];
}

export class UpdateCommitteeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chairman_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  secretary_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  internal_1_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  internal_2_id?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  external_reviewer_ids?: number[];
}

export class CommitteeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  name?: string;
}

// Response DTOs
export class CommitteeMemberDto {
  id: number;
  name: string;
  teacher_id: string;
  role: CommitteeRole;
  role_label: string;
}

export class CommitteeResponseDto {
  id: number;
  name: string;
  chairman_id: number | null;
  chairman_name: string | null;
  secretary_id: number | null;
  secretary_name: string | null;
  internal_1_id: number | null;
  internal_1_name: string | null;
  internal_2_id: number | null;
  internal_2_name: string | null;
  external_reviewers: ExternalReviewerDto[];
  member_count: number;
  created_at: Date;
  updated_at: Date;
}

export class ExternalReviewerDto {
  id: number;
  teacher_id: string;
  name: string;
  email: string;
}

export class TeacherBasicDto {
  id: number;
  teacher_id: string;
  name: string;
  email: string;
  department: string | null;
  faculty: string | null;
}

export class CommitteeStatsDto {
  total_committees: number;
  committees_with_full_members: number;
  committees_missing_members: number;
  total_external_reviewers: number;
}
