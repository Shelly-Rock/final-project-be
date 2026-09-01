import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { EmailService } from '@/modules/email';
import { v4 as uuidv4 } from 'uuid';
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
  UserRespDTO,
  RoleRespDTO,
} from './dto/auth.dto';
import { RegisterReqDTO, RegisterRespDTO } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = '1111';
const TOKEN_EXPIRY_HOURS = 24;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async login(dto: LoginReqDTO): Promise<LoginRespDTO> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.username }],
      },
      include: {
        user_roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (!user.email_verified_at) {
      throw new ForbiddenException('Please verify your email first');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const roles = this.mapRoles(user);
    const primaryRole = this.pickPrimaryRole(roles);

    if (!primaryRole) {
      throw new UnauthorizedException('User has no role assigned');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      primaryRole.name,
      roles.map((r) => r.name),
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.mapToUserResp(user),
    };
  }

  async verifyEmail(dto: VerifyEmailReqDTO): Promise<VerifyEmailRespDTO> {
    const token = await this.prisma.email_verification_tokens.findUnique({
      where: { token: dto.token },
      include: { users: true },
    });

    if (!token) {
      throw new BadRequestException('Invalid verification token');
    }

    if (token.used_at) {
      throw new BadRequestException(
        'This verification link has already been used',
      );
    }

    if (token.expires_at < new Date()) {
      throw new BadRequestException('This verification link has expired');
    }

    await this.prisma.user.update({
      where: { id: token.user_id },
      data: { email_verified_at: new Date() },
    });

    return {
      success: true,
      message: 'Email verified successfully. Please change your password.',
    };
  }

  async changePassword(
    dto: ChangePasswordReqDTO,
  ): Promise<ChangePasswordRespDTO> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.username }],
      },
      include: { student: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email_verified_at) {
      throw new ForbiddenException(
        'Email must be verified before changing password. Please verify your email first.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        must_change_password: false,
      },
    });

    try {
      await this.emailService.sendPasswordChangedNotification(
        user.email,
        user.student?.first_name || 'Người dùng',
      );
    } catch (error) {
      console.error('Password changed, but notification email failed:', error);
    }

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async forgotPassword(
    dto: ForgotPasswordReqDTO,
  ): Promise<ForgotPasswordRespDTO> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { student: true },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.',
      };
    }

    // Delete any existing reset tokens for this user
    await this.prisma.email_verification_tokens.deleteMany({
      where: { user_id: user.id },
    });

    // Create new reset token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    await this.prisma.email_verification_tokens.create({
      data: {
        user_id: user.id,
        token,
        expires_at: expiresAt,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        token,
        user.student?.first_name || 'Người dùng',
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.',
      };
    }

    return {
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(
    dto: ResetPasswordReqDTO,
  ): Promise<ResetPasswordRespDTO> {
    const token = await this.prisma.email_verification_tokens.findUnique({
      where: { token: dto.token },
      include: { users: { include: { student: true } } },
    });

    if (!token) {
      throw new BadRequestException('Invalid reset token');
    }

    if (token.used_at) {
      throw new BadRequestException('This reset link has already been used');
    }

    if (token.expires_at < new Date()) {
      throw new BadRequestException('This reset link has expired');
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: token.user_id },
        data: {
          password_hash: hashedPassword,
          must_change_password: false,
        },
      });

      await tx.email_verification_tokens.update({
        where: { id: token.id },
        data: { used_at: new Date() },
      });
    });

    try {
      await this.emailService.sendPasswordChangedNotification(
        token.users.email,
        token.users.student?.first_name || 'Người dùng',
      );
    } catch (error) {
      console.error('Password reset, but notification email failed:', error);
    }

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async refreshToken(
    dto: RefreshTokenReqDTO,
  ): Promise<RefreshTokenRespDTO> {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refresh.secret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { user_roles: { include: { role: true } } },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Account is deactivated');
      }

      const roles = this.mapRoles(user);
      const primaryRole = this.pickPrimaryRole(roles);

      if (!primaryRole) {
        throw new UnauthorizedException('User has no role assigned');
      }

      const tokens = await this.generateTokens(
        user.id,
        user.email,
        primaryRole.name,
        roles.map((r) => r.name),
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async resendVerification(
    dto: ResendVerificationReqDTO,
  ): Promise<ResendVerificationRespDTO> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { student: true },
    });

    if (!user) {
      throw new NotFoundException('User not found with this email');
    }

    if (user.email_verified_at) {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationEmail(user);

    return {
      success: true,
      message: 'Verification email sent successfully',
    };
  }

  async register(dto: RegisterReqDTO): Promise<RegisterRespDTO> {
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUserByEmail) {
      throw new BadRequestException(
        `Email ${dto.email} already has an account`,
      );
    }

    const existingUserByUsername = await this.prisma.user.findUnique({
      where: { username: dto.studentId },
    });

    if (existingUserByUsername) {
      throw new BadRequestException(
        `Student ID ${dto.studentId} already has an account`,
      );
    }

    const existingStudent = await this.prisma.student.findUnique({
      where: { student_id: dto.studentId },
    });

    if (existingStudent && existingStudent.user_id) {
      throw new BadRequestException(
        `Student ID ${dto.studentId} is already linked to an account`,
      );
    }

    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'STUDENT' },
    });

    if (!studentRole) {
      throw new BadRequestException('STUDENT role not found');
    }

    const hashedPassword = await bcrypt.hash(
      DEFAULT_PASSWORD,
      BCRYPT_SALT_ROUNDS,
    );

    const fullName = [dto.firstName, dto.middleName, dto.lastName]
      .filter(Boolean)
      .join(' ');

    const verificationEmail = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.studentId,
          password_hash: hashedPassword,
          must_change_password: true,
          email_verified_at: null,
          is_active: true,
          user_roles: {
            create: [{ role_id: studentRole.id }],
          },
        },
      });

      if (existingStudent) {
        await tx.user.update({
          where: { id: user.id },
          data: { student: { connect: { id: existingStudent.id } } },
        });
      } else {
        await tx.student.create({
          data: {
            student_id: dto.studentId,
            first_name: dto.firstName,
            last_name: dto.lastName,
            middle_name: dto.middleName || '',
            date_of_birth: new Date(dto.dateOfBirth),
            gender: dto.gender,
            class_name: dto.className,
            major: dto.major,
            course_year: dto.courseYear,
            academic_year: dto.academicYear,
            user_id: user.id,
          },
        });
      }

      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

      await tx.email_verification_tokens.create({
        data: {
          user_id: user.id,
          token,
          expires_at: expiresAt,
        },
      });

      return { email: dto.email, token, fullName };
    });

    let emailSent = true;
    try {
      await this.emailService.sendVerificationEmail(
        verificationEmail.email,
        verificationEmail.token,
        verificationEmail.fullName,
      );
    } catch (error) {
      emailSent = false;
      console.error(
        'Registration succeeded, but verification email failed:',
        error,
      );
    }

    return {
      success: true,
      message: emailSent
        ? 'Tài khoản đã được tạo. Vui lòng kiểm tra email để xác minh.'
        : 'Tài khoản đã được tạo nhưng không thể gửi email xác minh. Vui lòng yêu cầu gửi lại email.',
    };
  }

  async sendVerificationEmailToUser(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email_verified_at) {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationEmail(user);
  }

  async createStudentAccount(
    email: string,
    studentId: string,
    studentName: string,
  ): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(`Email ${email} already has an account`);
    }

    const existingStudentUser = await this.prisma.user.findUnique({
      where: { username: studentId },
    });

    if (existingStudentUser) {
      throw new BadRequestException(
        `Student ID ${studentId} already has an account`,
      );
    }

    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'STUDENT' },
    });

    if (!studentRole) {
      throw new BadRequestException('STUDENT role not found');
    }

    const hashedPassword = await bcrypt.hash(
      DEFAULT_PASSWORD,
      BCRYPT_SALT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email,
        username: studentId,
        password_hash: hashedPassword,
        must_change_password: true,
        email_verified_at: null,
        is_active: true,
        user_roles: {
          create: [{ role_id: studentRole.id }],
        },
      },
    });

    await this.sendVerificationEmail(user, studentName);
  }

  private async sendVerificationEmail(
    user: any,
    studentName?: string,
  ): Promise<void> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    await this.prisma.email_verification_tokens.create({
      data: {
        user_id: user.id,
        token,
        expires_at: expiresAt,
      },
    });

    const name = studentName || user.student?.first_name || 'Sinh viên';
    await this.emailService.sendVerificationEmail(user.email, token, name);
  }

  private async generateTokens(
    userId: number,
    email: string,
    role: string,
    roles: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email, role, roles };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refresh.secret'),
      expiresIn: this.configService.get<string>('jwt.refresh.expiresIn') as any,
    });

    return { accessToken, refreshToken };
  }

  private mapRoles(user: {
    user_roles?: { role: { id: number; name: string; display_name: string; priority: number } }[];
  }): RoleRespDTO[] {
    return (user.user_roles ?? [])
      .map(({ role }) => ({
        id: role.id,
        name: role.name,
        displayName: role.display_name,
        priority: role.priority,
      }))
      .sort((a, b) => b.priority - a.priority)
      .map(({ id, name, displayName }) => ({ id, name, displayName }));
  }

  private pickPrimaryRole(roles: RoleRespDTO[]): RoleRespDTO | undefined {
    return roles[0];
  }

  private mapToUserResp(user: any): UserRespDTO {
    const roles = this.mapRoles(user);
    const primaryRole = this.pickPrimaryRole(roles);

    if (!primaryRole) {
      throw new UnauthorizedException('User has no role assigned');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      mustChangePassword: user.must_change_password,
      emailVerifiedAt: user.email_verified_at,
      role: primaryRole,
      roles,
    };
  }
}
