import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateStudentReqDTO {
  // Note: email đã được chuyển sang User model - không còn trong Student

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  middleName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  className?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  major?: string;

  @IsOptional()
  @IsInt()
  courseYear?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  academicYear?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectName?: string;

  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>;
}
