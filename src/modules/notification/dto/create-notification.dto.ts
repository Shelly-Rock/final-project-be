import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType, description: 'Type of notification' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    example: 'New submission received',
    description: 'Notification title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Student submitted their thesis',
    description: 'Notification message',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 1, description: 'ID of the recipient user' })
  @IsInt()
  recipient_id: number;

  @ApiProperty({
    example: 2,
    required: false,
    nullable: true,
    description: 'ID of the sender user',
  })
  @IsInt()
  @IsOptional()
  sender_id?: number;

  @ApiProperty({
    example: 5,
    required: false,
    nullable: true,
    description: 'Related student ID',
  })
  @IsInt()
  @IsOptional()
  related_student_id?: number;

  @ApiProperty({
    example: 10,
    required: false,
    nullable: true,
    description: 'Related report ID',
  })
  @IsInt()
  @IsOptional()
  related_report_id?: number;
}
