import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    example: [1, 2, 3],
    description: 'Mảng ID permissions (thay thế toàn bộ)',
  })
  @IsArray()
  @IsInt({ each: true })
  permission_ids: number[];
}
