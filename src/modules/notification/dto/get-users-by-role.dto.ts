import { IsEnum } from 'class-validator';

export enum RecipientRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export class GetUsersByRoleDto {
  @IsEnum(RecipientRole)
  role: RecipientRole;
}

export class UserResponseDto {
  id: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}
