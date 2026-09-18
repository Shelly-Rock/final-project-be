import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationPriority {
  NORMAL = 'NORMAL',
  DIRECTIVE = 'DIRECTIVE',
  URGENT = 'URGENT',
  REMINDER = 'REMINDER',
}

export class ComposeNotificationDto {
  @ApiProperty({
    enum: NotificationPriority,
    description: 'Priority level of notification',
  })
  @IsEnum(NotificationPriority)
  priority: NotificationPriority;

  @ApiProperty({ example: 'Tiêu đề thông báo' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Nội dung chi tiết thông báo' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    example: [1, 2, 3],
    description: 'List of recipient user IDs or role IDs',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  recipientIds: number[];

  @ApiProperty({
    example: 'department',
    description: 'Type of recipient: user, department, faculty, role',
  })
  @IsString()
  @IsNotEmpty()
  recipientType: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  requireReadConfirmation?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  pinToTop?: boolean;

  @ApiProperty({ example: 'draft123', required: false })
  @IsString()
  @IsOptional()
  draftId?: string;
}
