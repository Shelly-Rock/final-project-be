import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TeacherStatus } from '@prisma/client';

export class ToggleTeacherStatusDto {
  @ApiProperty({ enum: TeacherStatus, example: TeacherStatus.active })
  @IsNotEmpty()
  @IsEnum(TeacherStatus, { message: 'Trạng thái phải là active hoặc inactive' })
  status: TeacherStatus;
}
