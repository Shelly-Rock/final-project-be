import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  Matches,
  IsOptional,
  IsEnum,
  MaxDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, AcademicTitle } from '@prisma/client';

export class CreateTeacherDto {
  @ApiProperty({ description: 'Mã giảng viên', example: 'GV001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^GV\d+$/, {
    message: 'Mã giảng viên bắt buộc phải có định dạng GV + số',
  })
  code: string;

  @ApiProperty({
    description: 'Họ và tên',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Email trường', example: 'nva@nttu.edu.vn' })
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._%+-]+@nttu\.edu\.vn$/, {
    message: 'Email phải thuộc domain @nttu.edu.vn',
  })
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại không đúng định dạng Việt Nam',
  })
  phone?: string;

  @ApiProperty({ description: 'Mã Khoa', example: 'KHOA_CNTT' })
  @IsString()
  @IsNotEmpty()
  facultyId: string;

  @ApiProperty({ description: 'Mã Bộ môn', example: 'BM_KTPM' })
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Học hàm, học vị',
    enum: AcademicTitle,
  })
  @IsOptional()
  @IsEnum(AcademicTitle, {
    message: 'Học hàm, học vị không hợp lệ',
  })
  academicTitle?: AcademicTitle;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Giảng viên' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh (ISO 8601)',
    example: '1990-01-15',
  })
  @IsOptional()
  @Type(() => Date)
  @MaxDate(new Date(), {
    message: 'Ngày sinh không được lớn hơn ngày hiện tại',
  })
  dateOfBirth?: Date;

  @ApiPropertyOptional({ description: 'Giới tính', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Địa chỉ', example: 'TP. Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  address?: string;
}
