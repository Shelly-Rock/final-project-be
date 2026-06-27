import { IsString, IsOptional, IsBoolean, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMajorDto {
  @ApiProperty({ example: 'CNTT', description: 'Major code' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Công nghệ thông tin', description: 'Major name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'uuid-department-id', description: 'Department ID' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMajorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
