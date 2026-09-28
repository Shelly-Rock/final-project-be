import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** A secretary account is provisioned directly, without Gmail verification. */
export class CreateSecretaryReqDTO {
  @ApiProperty({ example: 'secretary_cntt' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'secretary-password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'secretary-cntt@local.invalid',
    description:
      'Optional contact email. When omitted, a local placeholder is generated; no verification email is sent.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'TK_CNTT',
    description: 'Stable secretary code. Defaults to username.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  secretary_id?: string;

  @ApiProperty({ example: 'KHOA_CNTT' })
  @IsString()
  @IsNotEmpty()
  faculty_id: string;
}
