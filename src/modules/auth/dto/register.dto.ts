import {
  IsEmail,
  IsEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
//Request
export class RegisterReqDTO {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Email Register',
  })
  @IsEmail()
  email: string;
  studentId: string;
}
//Response
export class RegisterRespDTO {}
