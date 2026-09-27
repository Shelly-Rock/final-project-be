import { ApiProperty } from '@nestjs/swagger';

export class FacultyResponseDto {
  @ApiProperty({ example: 'KHOA_CNTT' })
  id: string;

  @ApiProperty({ example: 'Khoa Công nghệ thông tin' })
  name: string;

  @ApiProperty({ example: 'Đơn vị phụ trách các ngành công nghệ thông tin', required: false })
  description?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-09-27T00:00:00.000Z', required: false })
  createdAt?: Date;

  @ApiProperty({ example: '2026-09-27T00:00:00.000Z', required: false })
  updatedAt?: Date;
}
