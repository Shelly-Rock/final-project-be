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
import { NotificationPriority } from './compose-notification.dto';

export class DraftNotificationDto {
  @ApiProperty({ example: 'draft123', required: false })
  @IsString()
  @IsOptional()
  id?: string;

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
    description: 'List of recipient user IDs',
  })
  @IsArray()
  @ArrayMinSize(0)
  @IsInt({ each: true })
  recipientIds: number[];

  @ApiProperty({
    example: 'department',
    description: 'Type of recipient',
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

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: any;
}
