import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertEvent,
  AlertRecipientRole,
  AlertStatus,
  DeadlineType,
} from '@prisma/client';

export class SendDeadlineAlertsDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty({ enum: DeadlineType })
  @IsEnum(DeadlineType)
  deadlineType: DeadlineType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  deadlineSeq = 1;

  @ApiProperty({ enum: AlertEvent })
  @IsEnum(AlertEvent)
  event: AlertEvent;

  @ApiPropertyOptional({ enum: AlertRecipientRole })
  @IsOptional()
  @IsEnum(AlertRecipientRole)
  recipientRole?: AlertRecipientRole;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  recipientIds?: number[];
}

export class AlertLogsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;

  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @IsEnum(DeadlineType)
  deadlineType?: DeadlineType;

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
