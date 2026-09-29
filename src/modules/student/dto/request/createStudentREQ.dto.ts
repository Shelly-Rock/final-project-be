import {
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  IsDateString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateStudentReqDTO {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsString()
  @IsNotEmpty()
  className: string;

  @IsString()
  @IsNotEmpty()
  major: string;

  @IsInt()
  courseYear: number;

  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>;
}
export class CreateStudentsReqDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStudentReqDTO)
  students: CreateStudentReqDTO[];
}
