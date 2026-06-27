import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe Updated',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UserResponseDto {
  @ApiProperty({
    example: 'clx1234567890',
    description: 'Unique user identifier (CUID)',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User display name',
  })
  name: string | null;

  @ApiProperty({
    example: 'USER',
    enum: ['USER', 'ADMIN'],
    description: 'User role',
  })
  role: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class UsersListResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: [UserResponseDto],
    example: [
      {
        id: 'clx1234567890',
        email: 'user1@example.com',
        name: 'User One',
        role: 'USER',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'clx0987654321',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
  })
  data: UserResponseDto[];
}

export class DeleteResponseDto {
  @ApiProperty({
    example: 'User deleted successfully',
    description: 'Deletion confirmation message',
  })
  message: string;
}

export class UserNotFoundResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'User with ID xyz not found' })
  message: string;

  @ApiProperty({ example: 'NotFoundException' })
  error: string;
}

export class ForbiddenResponseDto {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'Forbidden resource' })
  message: string;

  @ApiProperty({ example: 'ForbiddenException' })
  error: string;
}
