import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTeacherQuotaDto {
  @ApiProperty({ description: 'Chỉ tiêu số lượng đề tài mới', example: 5 })
  @IsInt()
  @Min(1, { message: 'Chỉ tiêu giao tối thiểu phải là 1' })
  assignedQuota: number;
}
