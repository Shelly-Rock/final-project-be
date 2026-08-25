import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRoleDto {
  @ApiProperty({ example: 'MODERATOR', description: 'Tên role (unique)' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Người kiểm duyệt', description: 'Tên hiển thị' })
  @IsString()
  display_name: string;

  @ApiPropertyOptional({ example: 'Quyền kiểm duyệt nội dung', description: 'Mô tả' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: false, description: 'Là role hệ thống' })
  @IsBoolean()
  @IsOptional()
  is_system?: boolean;

  @ApiPropertyOptional({ example: 3, description: 'Độ ưu tiên (số càng lớn càng cao)' })
  @IsInt()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ example: [1, 2, 3], description: 'Mảng ID permissions' })
  @IsArray()
  @IsOptional()
  permission_ids?: number[];
}
