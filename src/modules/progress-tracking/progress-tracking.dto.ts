// Progress Tracking Enums - using string literal types for Prisma 7 compatibility
export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
export type ProgressStatus = 'ON_TRACK' | 'EXTENDED' | 'TOPIC_CHANGED' | 'BANNED';
export type TemplateType = 'MONTHLY_REPORT' | 'MIDTERM_REPORT' | 'FINAL_REPORT' | 'PROPOSAL' | 'PRESENTATION';
export type NotificationType = 'STATUS_CHANGED' | 'REPORT_SUBMITTED' | 'REPORT_APPROVED' | 'REPORT_REJECTED' | 'BAN_APPLIED' | 'BAN_WARNING';

// Enum constants for comparison
export const ReportStatus = {
  PENDING: 'PENDING' as ReportStatus,
  APPROVED: 'APPROVED' as ReportStatus,
  REJECTED: 'REJECTED' as ReportStatus,
  REVISION_REQUESTED: 'REVISION_REQUESTED' as ReportStatus,
};

export const ProgressStatus = {
  ON_TRACK: 'ON_TRACK' as ProgressStatus,
  EXTENDED: 'EXTENDED' as ProgressStatus,
  TOPIC_CHANGED: 'TOPIC_CHANGED' as ProgressStatus,
  BANNED: 'BANNED' as ProgressStatus,
};

export const TemplateType = {
  MONTHLY_REPORT: 'MONTHLY_REPORT' as TemplateType,
  MIDTERM_REPORT: 'MIDTERM_REPORT' as TemplateType,
  FINAL_REPORT: 'FINAL_REPORT' as TemplateType,
  PROPOSAL: 'PROPOSAL' as TemplateType,
  PRESENTATION: 'PRESENTATION' as TemplateType,
};

export const NotificationType = {
  STATUS_CHANGED: 'STATUS_CHANGED' as NotificationType,
  REPORT_SUBMITTED: 'REPORT_SUBMITTED' as NotificationType,
  REPORT_APPROVED: 'REPORT_APPROVED' as NotificationType,
  REPORT_REJECTED: 'REPORT_REJECTED' as NotificationType,
  BAN_APPLIED: 'BAN_APPLIED' as NotificationType,
  BAN_WARNING: 'BAN_WARNING' as NotificationType,
};

// ========== Request DTOs ==========

import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max, IsBoolean, IsDateString } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

// Template DTOs
export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  type: TemplateType;

  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsInt()
  file_size: number;
}

export class TemplateQueryDto {
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
  type?: TemplateType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacher_id?: number;
}

// Report DTOs
export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}

export class ReviewReportDto {
  @IsString()
  @IsNotEmpty()
  status: ReportStatus;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  score?: number;
}

export class ReportQueryDto {
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
  status?: ReportStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  student_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacher_id?: number;
}

// Student Progress DTOs
export class UpdateStudentProgressDto {
  @IsOptional()
  @IsString()
  status?: ProgressStatus;

  @IsOptional()
  @IsString()
  ban_reason?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  total_reports_required?: number;

  @IsOptional()
  @IsDateString()
  next_deadline?: string;
}

export class StudentProgressQueryDto {
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
  status?: ProgressStatus;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  is_banned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacher_id?: number;
}

// Notification DTOs
export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sender_id?: number;

  @IsInt()
  recipient_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  related_student_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  related_report_id?: number;
}

export class NotificationQueryDto {
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
  @IsBoolean()
  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  is_read?: boolean;

  @IsOptional()
  @IsString()
  type?: NotificationType;
}

// ========== Response DTOs ==========

export class ReportTemplateResponseDto {
  id: number;
  name: string;
  description: string | null;
  type: TemplateType;
  file_url: string;
  file_name: string;
  file_size: number;
  teacher_id: number;
  created_at: Date;
  updated_at: Date;
}

export class ProgressReportResponseDto {
  id: number;
  title: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  month: number;
  year: number;
  status: ReportStatus;
  feedback: string | null;
  score: number | null;
  student_id: number;
  teacher_id: number;
  student_name?: string;
  teacher_name?: string;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class StudentProgressResponseDto {
  id: number;
  student_id: number;
  student_name?: string;
  student_mssv?: string;
  topic_name?: string;
  teacher_id: number;
  teacher_name?: string;
  status: ProgressStatus;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: Date | null;
  total_reports_required: number;
  total_reports_submitted: number;
  next_deadline: Date | null;
  last_report_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class ProgressNotificationResponseDto {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  sender_id: number | null;
  recipient_id: number;
  related_student_id: number | null;
  related_report_id: number | null;
  created_at: Date;
}

export class ProgressStatsDto {
  total_students: number;
  on_track: number;
  extended: number;
  topic_changed: number;
  banned: number;
  pending_reports: number;
  approved_reports: number;
  rejected_reports: number;
}

export class BanWarningDto {
  student_id: number;
  student_name: string;
  days_until_ban: number;
  reports_submitted: number;
  reports_required: number;
}
