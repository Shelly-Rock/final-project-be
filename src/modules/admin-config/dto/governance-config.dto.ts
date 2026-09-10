import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeadlineType } from '@prisma/client';

export class PeriodDeadlineDto {
  @ApiProperty({ enum: DeadlineType })
  @IsEnum(DeadlineType)
  type: DeadlineType;

  @ApiProperty({ minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ example: 'Hạn đăng ký đề tài' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.000Z' })
  @IsISO8601({ strict: true })
  deadlineAt: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled: boolean;
}

export class UpdateGovernanceConfigDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty({ default: 3, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  defaultTopicLimit: number;

  @ApiProperty({ default: 10, minimum: 3, maximum: 10 })
  @IsInt()
  @Min(3)
  @Max(10)
  maxTopicLimit: number;

  @ApiProperty({ default: 3, minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  maxStudentsPerTopic: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  alertsEnabled: boolean;

  @ApiProperty({ type: [Number], example: [3, 1, 0] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsIn([0, 1, 3], { each: true })
  alertOffsetsDays: number[];

  @ApiProperty({ type: [PeriodDeadlineDto] })
  @IsArray()
  @ArrayMinSize(5)
  @ValidateNested({ each: true })
  @Type(() => PeriodDeadlineDto)
  deadlines: PeriodDeadlineDto[];
}
