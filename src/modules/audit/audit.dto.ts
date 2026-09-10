import { IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction, AuditEntityType } from '@prisma/client';

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(AuditEntityType)
  entity_type?: AuditEntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entity_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actor_user_id?: number;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
