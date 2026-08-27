import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class RejectRegistrationDto {
  @ApiProperty({ description: 'ID của sinh viên bị từ chối', example: 101 })
  @IsInt()
  @IsNotEmpty({ message: 'ID sinh viên không được để trống' })
  studentId: number;

  @ApiProperty({ 
    description: 'Lý do từ chối đăng ký', 
    example: 'Đề tài không phù hợp với chuyên ngành của em' 
  })
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải nhập lý do từ chối' })
  reason: string;
}