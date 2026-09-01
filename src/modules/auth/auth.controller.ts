import {
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Controller,
  UseGuards,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '@/core/auth/decorators/public.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import {
  LoginReqDTO,
  LoginRespDTO,
  VerifyEmailReqDTO,
  VerifyEmailRespDTO,
  ChangePasswordReqDTO,
  ChangePasswordRespDTO,
  ResendVerificationReqDTO,
  ResendVerificationRespDTO,
  ForgotPasswordReqDTO,
  ForgotPasswordRespDTO,
  ResetPasswordReqDTO,
  ResetPasswordRespDTO,
  RefreshTokenReqDTO,
  RefreshTokenRespDTO,
} from './dto/auth.dto';
import { RegisterReqDTO, RegisterRespDTO } from './dto/register.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiBody({ type: LoginReqDTO })
  @ApiOkResponse({ type: LoginRespDTO, description: 'Login successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiForbiddenResponse({ description: 'Email not verified or must change password' })
  async login(@Body() dto: LoginReqDTO): Promise<LoginRespDTO> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student account' })
  @ApiBody({ type: RegisterReqDTO })
  @ApiOkResponse({ type: RegisterRespDTO, description: 'Account created, verification email sent' })
  @ApiBadRequestResponse({ description: 'Validation error or user already exists' })
  async register(@Body() dto: RegisterReqDTO): Promise<RegisterRespDTO> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from email link' })
  @ApiBody({ type: VerifyEmailReqDTO })
  @ApiOkResponse({ type: VerifyEmailRespDTO, description: 'Email verified successfully' })
  @ApiBadRequestResponse({ description: 'Invalid, expired or already used token' })
  async verifyEmail(@Body() dto: VerifyEmailReqDTO): Promise<VerifyEmailRespDTO> {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link via email' })
  @ApiBody({ type: ForgotPasswordReqDTO })
  @ApiOkResponse({ type: ForgotPasswordRespDTO, description: 'Password reset email sent' })
  @ApiBadRequestResponse({ description: 'Invalid email' })
  async forgotPassword(@Body() dto: ForgotPasswordReqDTO): Promise<ForgotPasswordRespDTO> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiBody({ type: ResetPasswordReqDTO })
  @ApiOkResponse({ type: ResetPasswordRespDTO, description: 'Password reset successfully' })
  @ApiBadRequestResponse({ description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordReqDTO): Promise<ResetPasswordRespDTO> {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for logged in user' })
  @ApiBody({ type: ChangePasswordReqDTO })
  @ApiOkResponse({ type: ChangePasswordRespDTO, description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(
    @Body() dto: ChangePasswordReqDTO,
    @CurrentUser() user: any,
  ): Promise<ChangePasswordRespDTO> {
    return this.authService.changePassword(dto, user.sub);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenReqDTO })
  @ApiOkResponse({ type: RefreshTokenRespDTO, description: 'Token refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenReqDTO): Promise<RefreshTokenRespDTO> {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({ type: ResendVerificationReqDTO })
  @ApiOkResponse({ type: ResendVerificationRespDTO, description: 'Verification email sent' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Email already verified' })
  async resendVerification(
    @Body() dto: ResendVerificationReqDTO,
  ): Promise<ResendVerificationRespDTO> {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user info' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
