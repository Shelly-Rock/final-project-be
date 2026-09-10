import { IsString, IsNotEmpty, IsEmail, IsArray, IsInt, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserReqDTO {
  @ApiProperty({ example: 'john.doe', description: 'Username duy nhất' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Email duy nhất' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Mật khẩu (tối thiểu 6 ký tự)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: [1, 2], description: 'Mảng role IDs cần gán cho user', type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  role_ids?: number[];
}
