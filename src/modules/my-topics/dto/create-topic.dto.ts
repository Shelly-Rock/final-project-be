import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNotEmpty, 
  IsInt, 
  IsBoolean, 
  IsOptional, 
  IsArray, 
  Min 
} from 'class-validator';

export class CreateTopicDto {
  @ApiProperty({ description: 'Tên đề tài tiếng Việt', example: 'Nghiên cứu ứng dụng AI trong Y tế' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Tên đề tài tiếng Anh', example: 'Application of AI in Healthcare' })
  @IsString()
  @IsOptional()
  englishName?: string;

  @ApiProperty({ description: 'Mô tả chi tiết đề tài', example: 'Xây dựng mô hình AI hỗ trợ chẩn đoán bệnh...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Mục tiêu của đề tài', example: 'Đạt độ chính xác >90%' })
  @IsString()
  @IsNotEmpty()
  objectives: string;

  @ApiProperty({ description: 'Công nghệ sử dụng', example: 'Python, ReactJS, PostgreSQL' })
  @IsString()
  @IsNotEmpty()
  technologies: string;

  @ApiProperty({ description: 'ID đợt đăng ký', example: 1 })
  @IsInt()
  @IsNotEmpty()
  periodId: number;

  @ApiProperty({ description: 'Số lượng sinh viên tối đa', example: 2, minimum: 1 })
  @IsInt()
  @Min(1, { message: 'Số lượng sinh viên tối đa phải từ 1 trở lên' })
  @IsNotEmpty()
  maxStudents: number;

  @ApiPropertyOptional({ description: 'Đề tài ngoại lệ hay không', example: false })
  @IsBoolean()
  @IsOptional()
  isException?: boolean;

  @ApiProperty({ description: 'Khoa/Bộ môn của giảng viên', example: 'Công nghệ Phần mềm' })
  @IsString()
  @IsNotEmpty()
  teacherDepartment: string;

  @ApiPropertyOptional({ 
    description: 'Danh sách ID sinh viên được phân công trước (nếu có)', 
    type: [Number], 
    example: [101, 102] 
  })
  @IsArray()
  @IsOptional()
  preAssignedStudentIds?: number[];
}