import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, Min, Max, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ScoringType, ScoringStatus, CommitteeRole } from '@prisma/client';

// Create Independent Score DTO
export class CreateIndependentScoreDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  teacherId: number;

  @ApiProperty({ enum: ScoringType })
  @IsEnum(ScoringType)
  scoringType: ScoringType;

  @ApiPropertyOptional({ enum: CommitteeRole })
  @IsOptional()
  @IsEnum(CommitteeRole)
  role?: CommitteeRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deadline?: Date;
}

// Update Score DTO
export class UpdateScoreDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  criteriaScores?: Record<string, number>;

  @ApiPropertyOptional({ enum: ScoringStatus })
  @IsOptional()
  @IsEnum(ScoringStatus)
  status?: ScoringStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weaknesses?: string;
}

// Submit Score DTO
export class SubmitScoreDto {
  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(10)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  criteriaScores?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weaknesses?: string;
}

// Query DTOs
export class QueryScoresDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ScoringType })
  @IsOptional()
  @IsEnum(ScoringType)
  scoringType?: ScoringType;

  @ApiPropertyOptional({ enum: ScoringStatus })
  @IsOptional()
  @IsEnum(ScoringStatus)
  status?: ScoringStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  studentId?: number;
}

export class QueryMyScoresDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ScoringStatus })
  @IsOptional()
  @IsEnum(ScoringStatus)
  status?: ScoringStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scoringType?: ScoringType;
}

// Response DTOs
export class IndependentScoreResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  projectId: number;

  @ApiProperty()
  studentId: number;

  @ApiProperty()
  teacherId: number;

  @ApiProperty({ enum: ScoringType })
  scoringType: ScoringType;

  @ApiProperty({ enum: CommitteeRole, nullable: true })
  role: CommitteeRole | null;

  @ApiProperty()
  score: number | null;

  @ApiProperty()
  maxScore: number;

  @ApiProperty()
  criteriaScores: Record<string, number> | null;

  @ApiProperty({ enum: ScoringStatus })
  status: ScoringStatus;

  @ApiProperty()
  deadline: Date | null;

  @ApiProperty()
  submittedAt: Date | null;

  @ApiProperty()
  notes: string | null;

  @ApiProperty()
  strengths: string | null;

  @ApiProperty()
  weaknesses: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  project?: {
    projectId: string;
    projectName: string;
  };

  @ApiPropertyOptional()
  student?: {
    studentId: string;
    name: string;
    className: string;
  };

  @ApiPropertyOptional()
  teacher?: {
    teacherId: string;
    name: string;
  };
}

export class ScoringStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  passed: number;
}

export class ScoringResultDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  projectId: number;

  @ApiProperty()
  studentId: number;

  @ApiProperty()
  gvhdScore: number | null;

  @ApiProperty()
  gvhdPassed: boolean;

  @ApiProperty()
  committeeScores: Array<{
    role: CommitteeRole;
    teacherId: number;
    teacherName: string;
    score: number;
    passed: boolean;
  }>;

  @ApiProperty()
  totalCommitteeScores: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  isEliminated: boolean;

  @ApiProperty()
  isGvhdFailed: boolean;

  @ApiProperty()
  finalStatus: string | null;

  @ApiProperty()
  scoreSheetUrl: string | null;
}
