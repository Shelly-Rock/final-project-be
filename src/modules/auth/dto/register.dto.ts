import {
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class RegisterReqDTO {
  @ApiProperty({ example: 'user@gmail.com', description: 'Email for the account' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '20210001', description: 'Student ID (MSSV)' })
  @IsString()
  @MaxLength(20)
  studentId: string;

  @ApiProperty({ example: 'Nguyễn', description: 'First name' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Văn', description: 'Middle name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: 'A', description: 'Last name' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: '2002-05-15', description: 'Date of birth (ISO string)' })
  @IsString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE, description: 'Gender' })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: 'K62-CK', description: 'Class name' })
  @IsString()
  @MaxLength(50)
  className: string;

  @ApiProperty({ example: 'Kỹ thuật phần mềm', description: 'Major' })
  @IsString()
  @MaxLength(200)
  major: string;

  @ApiProperty({ example: 2021, description: 'Course year' })
  @IsInt()
  courseYear: number;

  @ApiProperty({ example: '2021-2025', description: 'Academic year' })
  @IsString()
  @MaxLength(20)
  academicYear: string;
}

export class RegisterRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh.' })
  message: string;
}
