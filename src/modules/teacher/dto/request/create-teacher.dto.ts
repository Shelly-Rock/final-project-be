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
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, AcademicTitle } from '@prisma/client';

export class CreateTeacherDto {
  @ApiProperty({ description: 'Mã giảng viên', example: 'GV001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9._-]{2,50}$/, {
    message:
      'Mã giảng viên chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới',
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

  @ApiProperty({ description: 'Email giảng viên', example: 'nva@nttu.edu.vn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @Matches(/^0[35789][0-9]{8}$/, {
    message: 'Số điện thoại không đúng định dạng Việt Nam',
  })
  phone?: string;

  @ApiProperty({ description: 'Mã Khoa', example: 'KHOA_CNTT' })
  @IsString()
  @IsNotEmpty()
  facultyId: string;

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

  @ApiPropertyOptional({ description: 'Dữ liệu bổ sung (JSON)', example: '{}' })
  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>;
}
