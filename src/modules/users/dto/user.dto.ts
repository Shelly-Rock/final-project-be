import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '20210001', description: 'Student ID' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mssv?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  majorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mssv?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  majorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class ImportUserDto {
  @ApiProperty({ example: ['student1@example.com', 'student2@example.com'] })
  @IsString({ each: true })
  emails: string[];

  @ApiProperty({ example: ['Nguyen Van A', 'Tran Thi B'] })
  @IsString({ each: true })
  names: string[];

  @ApiPropertyOptional({ example: ['20210001', '20210002'] })
  @IsString({ each: true })
  mssvs?: string[];

  @ApiPropertyOptional({ example: ['STUDENT', 'TEACHER'] })
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: 'default123' })
  @IsOptional()
  @IsString()
  defaultPassword?: string;
}

export class UserQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  majorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  take?: number;
}
