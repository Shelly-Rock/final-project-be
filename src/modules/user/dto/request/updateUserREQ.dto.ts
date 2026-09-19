import {
  IsString,
  IsEmail,
  IsBoolean,
  IsArray,
  IsInt,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserReqDTO {
  @ApiProperty({
    example: 'john.updated@example.com',
    description: 'Email mới',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
    required: false,
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    example: true,
    description: 'Trạng thái kích hoạt',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    example: false,
    description: 'Bắt buộc đổi mật khẩu lần đăng nhập sau',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  must_change_password?: boolean;

  @ApiProperty({
    example: [1, 3],
    description: 'Mảng role IDs mới (thay thế hoàn toàn)',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  role_ids?: number[];
}
