import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';

export class CreateRegistrationDto {
  @ApiProperty({ example: 'uuid-topic-id' })
  @IsUUID()
  topicId: string;

  @ApiPropertyOptional({ example: 1, description: 'Choice order (1 = first choice)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  orderChoice?: number;

  @ApiPropertyOptional({ example: 'Đã học các môn liên quan', description: 'Priority reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  priorityReason?: string;
}

export class BulkRegistrationDto {
  @ApiProperty({
    example: [
      { topicId: 'uuid-topic-1', orderChoice: 1, priorityReason: 'First choice' },
      { topicId: 'uuid-topic-2', orderChoice: 2 },
    ],
  })
  @IsArray()
  registrations: Array<{
    topicId: string;
    orderChoice?: number;
    priorityReason?: string;
  }>;
}

export class ApproveRegistrationDto {
  @ApiPropertyOptional({ example: 'Đạt yêu cầu' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectRegistrationDto {
  @ApiProperty({ example: 'Sinh viên không đủ điều kiện' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RegistrationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number;

  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
