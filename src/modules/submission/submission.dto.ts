// Submission DTOs
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max } from 'class-validator';

export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum SubmissionType {
  WORD = 'WORD',
  PDF = 'PDF',
  POWERPOINT = 'POWERPOINT',
}

export class CreateSubmissionDto {
  @IsInt()
  @IsNotEmpty()
  student_id: number;

  @IsInt()
  @IsNotEmpty()
  project_id: number;

  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsString()
  @IsNotEmpty()
  original_name: string;

  @IsInt()
  file_size: number;

  @IsEnum(SubmissionType)
  file_type: SubmissionType;
}

export class ReviewSubmissionDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

export class SubmissionQueryDto {
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
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  student_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  project_id?: number;
}

// Response DTOs
export class SubmissionResponseDto {
  id: number;
  student_id: number;
  project_id: number;
  file_url: string;
  file_name: string;
  original_name: string;
  file_size: number;
  file_type: SubmissionType;
  status: SubmissionStatus;
  submitted_at: Date;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  student_name?: string;
  student_mssv?: string;
  project_name?: string;
  created_at: Date;
  updated_at: Date;
}

export class SubmissionStatsDto {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
