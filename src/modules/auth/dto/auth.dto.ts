import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ========== Login ==========
export class LoginReqDTO {
  @ApiProperty({
    example: 'SV001',
    description: 'Username, student ID, teacher ID, or email',
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}

// ========== Verify Email ==========
export class VerifyEmailReqDTO {
  @ApiProperty({
    example: 'abc123xyz456',
    description: 'Verification token from email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class VerifyEmailRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Email verified successfully. Please change your password.',
  })
  message: string;
}

// ========== Change Password (No login required, after email verification) ==========
export class ChangePasswordReqDTO {
  @ApiProperty({
    example: 'abc123xyz456',
    description: 'Email verification token',
  })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'New password (email must be verified first)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

// ========== Change Password (Logged in user) ==========
export class ChangePasswordMeReqDTO {
  @ApiProperty({
    example: 'currentPassword123',
    description: 'Current password',
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'New password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

// ========== Forgot Password ==========
export class ForgotPasswordReqDTO {
  @ApiProperty({
    example: 'sv001@gmail.com',
    description: 'Email to send password reset link',
  })
  @IsEmail()
  email: string;
}

export class ForgotPasswordRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password reset email sent successfully' })
  message: string;
}

// ========== Reset Password ==========
export class ResetPasswordReqDTO {
  @ApiProperty({
    example: 'abc123xyz456',
    description: 'Password reset token from email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    example: 'newPassword123',
    description: 'New password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ResetPasswordRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password reset successfully' })
  message: string;
}

// ========== Refresh Token ==========
export class RefreshTokenReqDTO {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token',
  })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class RefreshTokenRespDTO {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

export class ChangePasswordRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password changed successfully' })
  message: string;
}

// ========== Resend Verification Email ==========
export class ResendVerificationReqDTO {
  @ApiProperty({
    example: 'sv001@gmail.com',
    description: 'Email to resend verification',
  })
  @IsEmail()
  email: string;
}

export class ResendVerificationRespDTO {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Verification email sent successfully' })
  message: string;
}

// ========== Auth Response DTOs ==========
export class RoleRespDTO {
  id: number;
  name: string;
  displayName: string;
}

export class UserRespDTO {
  id: number;
  email: string;
  username: string;
  mustChangePassword: boolean;
  emailVerifiedAt: Date | null;
  role: RoleRespDTO;
  roles: RoleRespDTO[];
}

export class LoginRespDTO {
  accessToken: string;
  refreshToken: string;
  user: UserRespDTO;
}
