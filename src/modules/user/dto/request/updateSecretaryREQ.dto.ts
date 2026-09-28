import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateSecretaryReqDTO {
  @ApiPropertyOptional({ example: 'new-secretary@local.invalid' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'new-password', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'TK_CNTT' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  secretary_id?: string;

  @ApiPropertyOptional({ example: 'KHOA_CNTT' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  faculty_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  must_change_password?: boolean;
}
