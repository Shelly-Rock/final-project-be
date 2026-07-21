import {
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  IsDateString,
  IsEnum,
  IsArray,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateUserReqDTO {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  middleName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

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

  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>;
}
export class CreateUsersReqDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateUserReqDTO)
  users: CreateUserReqDTO[];
}
