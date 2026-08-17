// Defense Session DTOs
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max, IsArray, IsDateString } from 'class-validator';

export enum DefenseSessionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
}

export class CreateDefenseSessionDto {
  @IsInt()
  @IsNotEmpty()
  committee_id: number;

  @IsDateString()
  defense_date: string;

  @IsString()
  @IsNotEmpty()
  start_time: string; // "08:00"

  @IsString()
  @IsNotEmpty()
  room: string; // "A101"

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  duration_minutes?: number = 15;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  project_ids?: number[]; // Projects to assign to this session
}

export class UpdateDefenseSessionDto {
  @IsOptional()
  @IsDateString()
  defense_date?: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsEnum(DefenseSessionStatus)
  status?: DefenseSessionStatus;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  duration_minutes?: number;
}

export class AddProjectsToSessionDto {
  @IsArray()
  @IsInt({ each: true })
  project_ids: number[];
}

export class RemoveProjectFromSessionDto {
  @IsInt()
  project_id: number;
}

export class ScoreProjectDto {
  @IsInt()
  @IsNotEmpty()
  teacher_id: number;

  @IsInt()
  @IsNotEmpty()
  role: number; // CommitteeRole enum

  @IsInt()
  @Min(0)
  @Max(10)
  score: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DefenseSessionQueryDto {
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
  @Type(() => Number)
  @IsInt()
  committee_id?: number;

  @IsOptional()
  @IsEnum(DefenseSessionStatus)
  status?: DefenseSessionStatus;

  @IsOptional()
  @IsDateString()
  defense_date?: string;

  @IsOptional()
  @IsString()
  room?: string;
}

// Response DTOs
export class DefenseProjectDto {
  project_id: number;
  project_code: string;
  project_name: string;
  student_name: string;
  student_mssv: string;
  order_index: number;
  scheduled_time: string;
  score: number | null;
  defense_notes: string | null;
  defended_at: Date | null;
}

export class DefenseSessionResponseDto {
  id: number;
  committee_id: number;
  committee_name: string;
  defense_date: Date;
  start_time: string;
  end_time: string | null;
  room: string;
  duration_minutes: number;
  status: DefenseSessionStatus;
  projects: DefenseProjectDto[];
  project_count: number;
  estimated_end_time: string | null;
  created_at: Date;
  updated_at: Date;
}

export class DefenseScheduleExportDto {
  session_id: number;
  committee_name: string;
  date: string;
  room: string;
  start_time: string;
  end_time: string | null;
  duration_per_topic: number;
  projects: {
    order: number;
    time: string;
    project_code: string;
    project_name: string;
    student_name: string;
    student_mssv: string;
  }[];
}

export class DefenseStatsDto {
  total_sessions: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  total_projects_defended: number;
  average_score: number | null;
}
