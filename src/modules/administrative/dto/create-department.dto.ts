import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Bảng `departments` chỉ có id, name, faculty_id, created_at
 * (xem prisma/schema.prisma -> model Department).
 */
export class CreateDepartmentDto {
  @ApiProperty({ example: 'BM_KTPM', description: 'Mã bộ môn (duy nhất)' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id: string;

  @ApiProperty({ example: 'Bộ môn Kỹ thuật phần mềm' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'KHOA_CNTT', description: 'Mã khoa sở hữu' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  facultyId: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Bộ môn Kỹ thuật phần mềm' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'KHOA_CNTT' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  facultyId?: string;
}
