import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'New submission received' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Student submitted their thesis' })
  @IsString()
  message: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  recipient_id: number;

  @ApiProperty({ example: 2, required: false })
  @IsInt()
  @IsOptional()
  sender_id?: number;

  @ApiProperty({ example: 5, required: false })
  @IsInt()
  @IsOptional()
  related_student_id?: number;

  @ApiProperty({ example: 10, required: false })
  @IsInt()
  @IsOptional()
  related_report_id?: number;
}
