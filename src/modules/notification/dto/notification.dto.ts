import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  is_read: boolean;

  @ApiProperty({ nullable: true })
  sender_id: number | null;

  @ApiProperty()
  recipient_id: number;

  @ApiProperty({ nullable: true })
  related_student_id: number | null;

  @ApiProperty({ nullable: true })
  related_report_id: number | null;

  @ApiProperty()
  created_at: Date;
}
