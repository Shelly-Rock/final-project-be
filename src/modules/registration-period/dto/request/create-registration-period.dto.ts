import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsAfter } from './is-after.validator';

class DepartmentLimitDto {
  @ApiProperty({ description: 'Mã ngành (hoặc tên ngành)' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({
    description: 'Giới hạn sinh viên (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1, { message: 'Sĩ số tối đa phải từ 1 sinh viên trở lên' })
  @Max(10, { message: 'Sĩ số tối đa không được vượt quá 10 sinh viên' })
  maxStudents: number;
}

export class CreateRegistrationPeriodDto {
  @ApiProperty({
    description: 'Tên đợt đăng ký',
    example: 'Đợt đăng ký KLTN Học kỳ 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Học kỳ', enum: ['1', '2', '3'] })
  @IsIn(['1', '2', '3'], { message: 'Học kỳ chỉ được là 1, 2 hoặc 3' })
  semester: string;

  @ApiProperty({ description: 'Năm học', example: '2025-2026' })
  @IsString()
  @IsNotEmpty()
  schoolYear: string;

  @ApiProperty({ description: 'Ngày bắt đầu (ISO Date)' })
  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ description: 'Hạn chót nộp đề tài của Giảng viên (ISO Date)' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsAfter('startDate', {
    message: 'Hạn chót của Giảng viên phải sau Ngày bắt đầu',
  })
  teacherDeadline: Date;

  @ApiProperty({ description: 'Hạn chót đăng ký của Sinh viên (ISO Date)' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsAfter('teacherDeadline', {
    message: 'Hạn chót của Sinh viên phải sau Hạn chót Giảng viên',
  })
  studentDeadline: Date;

  @ApiProperty({
    description: 'Chỉ tiêu đề tài mặc định/GV (3-10)',
    minimum: 3,
    maximum: 10,
  })
  @IsInt()
  @Min(3, { message: 'Chỉ tiêu mặc định tối thiểu là 3 đề tài/GV' })
  @Max(10, { message: 'Chỉ tiêu mặc định tối đa là 10 đề tài/GV' })
  defaultQuota: number;

  @ApiPropertyOptional({ description: 'Mô tả hoặc ghi chú thêm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Cấu hình giới hạn sĩ số theo từng ngành',
    type: [DepartmentLimitDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentLimitDto)
  departmentStudentLimits?: DepartmentLimitDto[];
}
