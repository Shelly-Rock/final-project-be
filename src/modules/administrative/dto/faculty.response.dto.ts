import { ApiProperty } from '@nestjs/swagger';

export class FacultyResponseDto {
  @ApiProperty({ example: 'KHOA_CNTT' })
  id: string;

  @ApiProperty({ example: 'Khoa Công nghệ thông tin' })
  name: string;
}
