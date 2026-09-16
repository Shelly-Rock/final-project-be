import { IsArray, IsInt, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @ApiProperty({ example: 'Tiêu đề thông báo' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Nội dung chi tiết thông báo' })
  @IsString()
  message: string;

  @ApiProperty({ enum: [
    'STATUS_CHANGED',
    'REPORT_SUBMITTED',
    'REPORT_APPROVED',
    'REPORT_REJECTED',
    'BAN_APPLIED',
    'BAN_WARNING',
  ]})
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: [1, 2, 3], description: 'List of recipient user IDs' })
  @IsArray()
  @IsInt({ each: true })
  recipientIds: number[];

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @IsOptional()
  relatedStudentId?: number;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @IsOptional()
  relatedReportId?: number;
}
