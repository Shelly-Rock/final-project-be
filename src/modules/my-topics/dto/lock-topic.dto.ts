import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsInt, IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class TopicAssignmentDto {
  @ApiProperty({ description: 'ID sinh viên được phân công', example: 101 })
  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @ApiPropertyOptional({ description: 'Vai trò trong nhóm', example: 'Nhóm trưởng' })
  @IsString()
  @IsOptional()
  assignedRole?: string;

  @ApiPropertyOptional({ description: 'Công việc cụ thể được giao', example: 'Làm Backend và API' })
  @IsString()
  @IsOptional()
  assignedTask?: string;
}

export class LockTopicDto {
  @ApiPropertyOptional({ 
    description: 'Danh sách phân công nhiệm vụ cho sinh viên', 
    type: [TopicAssignmentDto] 
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TopicAssignmentDto)
  assignments?: TopicAssignmentDto[];
}