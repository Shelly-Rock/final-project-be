import { ApiProperty } from '@nestjs/swagger';

export class UserRoleRespDTO {
  @ApiProperty()
  role_id: number;

  @ApiProperty()
  role_name: string;

  @ApiProperty()
  role_display_name: string;
}

export class UserRespDTO {
  @ApiProperty()
  id: number;

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
  created_at: string;

  @ApiProperty()
  updated_at: string;

  @ApiProperty()
  deleted_at: string | null;

  @ApiProperty({ type: [UserRoleRespDTO] })
  roles: UserRoleRespDTO[];
}
