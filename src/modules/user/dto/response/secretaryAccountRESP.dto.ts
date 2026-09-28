import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecretaryAccountRespDTO {
  @ApiProperty()
  id: number;

  @ApiProperty()
  user_id: number;

  @ApiProperty()
  secretary_id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  must_change_password: boolean;

  @ApiProperty()
  email_verified_at: string | null;

  @ApiProperty()
  faculty_id: string | null;

  @ApiPropertyOptional()
  faculty_name?: string | null;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;

  @ApiProperty()
  deleted_at: string | null;
}
