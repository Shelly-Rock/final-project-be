import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'admin@qnq.edu.vn' })
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'student@qnq.edu.vn' })
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '20210001', description: 'Student ID (for students)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mssv?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
