import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsInt, IsBoolean } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Người kiểm duyệt', description: 'Tên hiển thị' })
  @IsString()
  @IsOptional()
  display_name?: string;

  @ApiPropertyOptional({ example: 'Quyền kiểm duyệt nội dung', description: 'Mô tả' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 3, description: 'Độ ưu tiên' })
  @IsInt()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ example: [1, 2, 3], description: 'Mảng ID permissions' })
  @IsArray()
  @IsOptional()
  permission_ids?: number[];
}
