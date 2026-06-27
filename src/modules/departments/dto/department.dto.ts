import { IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'KHTN', description: 'Department code' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Khoa Học Tự Nhiên', description: 'Department name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ default: true, description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'KHTN' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Khoa Học Tự Nhiên' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DepartmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  userCount?: number;
}

export class ImportDepartmentDto {
  @ApiProperty({ example: ['KHTN', 'KHXH', 'KT'] })
  @IsString({ each: true })
  codes: string[];

  @ApiProperty({ example: ['Khoa Học Tự Nhiên', 'Khoa Học Xã Hội', 'Kinh Tế'] })
  @IsString({ each: true })
  names: string[];
}
