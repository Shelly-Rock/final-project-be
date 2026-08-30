import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({
    example: [1, 2],
    description: 'Danh sách role ID gán cho user (thay thế toàn bộ)',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  role_ids: number[];
}
