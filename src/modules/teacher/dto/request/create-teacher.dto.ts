import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNotEmpty, 
  MaxLength, 
  IsEmail, 
  Matches, 
  IsOptional, 
  IsEnum, 
  MaxDate 
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateTeacherDto {
  @ApiProperty({ description: 'Mã giảng viên', example: 'GV001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^GV\d+$/, { message: 'Mã giảng viên bắt buộc phải có định dạng GV + số' })
  code: string;

  @ApiProperty({ description: 'Họ', example: 'Nguyễn', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ description: 'Tên', example: 'Văn A', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ description: 'Email trường', example: 'nva@nttu.edu.vn' })
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._%+-]+@nttu\.edu\.vn$/, { message: 'Email phải thuộc domain @nttu.edu.vn' })
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiProperty({ description: 'Chuyên ngành', example: 'Công nghệ phần mềm' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiPropertyOptional({ 
    description: 'Học hàm, học vị', 
    enum: ['Cử nhân', 'Thạc sĩ', 'Tiến sĩ', 'Phó GS', 'GS'] 
  })
  @IsOptional()
  @IsString()
  academicTitle?: string;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Giảng viên' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Ngày sinh (ISO 8601)', example: '1990-01-15' })
  @IsOptional()
  @Type(() => Date)
  @MaxDate(new Date(), { message: 'Ngày sinh không được lớn hơn ngày hiện tại' })
  dateOfBirth?: Date;

  @ApiPropertyOptional({ description: 'Giới tính', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Địa chỉ', example: 'TP. Cần Thơ' })
  @IsOptional()
  @IsString()
  address?: string;
}