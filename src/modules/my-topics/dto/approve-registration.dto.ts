import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class ApproveRegistrationDto {
  @ApiProperty({ description: 'ID của sinh viên cần duyệt', example: 101 })
  @IsInt()
  @IsNotEmpty({ message: 'ID sinh viên không được để trống' })
  studentId: number;
}