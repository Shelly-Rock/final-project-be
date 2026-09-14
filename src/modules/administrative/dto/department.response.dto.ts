import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({ example: 'BM_KTPM' })
  id: string;

  @ApiProperty({ example: 'Bộ môn Kỹ thuật phần mềm' })
  name: string;

  @ApiProperty({ example: 'KHOA_CNTT' })
  facultyId: string;
}
