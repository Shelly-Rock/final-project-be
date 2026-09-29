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

class FacultyLimitDto {
  @ApiProperty({ description: 'Mã khoa (hoặc tên khoa)' })
  @IsString()
  @IsNotEmpty()
  faculty: string;

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

  @ApiPropertyOptional({ description: 'Hạn chót nộp đề tài của Giảng viên (ISO Date)' })
  @IsOptional()
  @Type(() => Date)
  teacherDeadline?: Date;

  @ApiPropertyOptional({ description: 'Hạn chót đăng ký của Sinh viên (ISO Date)' })
  @IsOptional()
  @Type(() => Date)
  studentDeadline?: Date;

  @ApiProperty({
    description: 'Chỉ tiêu đề tài mặc định/GV (3-10)',
    minimum: 3,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  defaultQuota?: number;

  @ApiPropertyOptional({ description: 'Mô tả hoặc ghi chú thêm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Cấu hình giới hạn sĩ số theo từng khoa',
    type: [FacultyLimitDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacultyLimitDto)
  facultyStudentLimits?: FacultyLimitDto[];
}
