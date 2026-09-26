import { ConflictException, BadRequestException, Injectable } from '@nestjs/common';
import { AuthService } from '@/modules/auth/auth.service';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateTeacherDto } from '../dto';
import { TeacherMapper } from '../mapper/teacher.mapper';
import { TeacherStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = '1111';

@Injectable()
export class CreateTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async createTeacher(dto: CreateTeacherDto) {
    const teachers = await this.createTeachers([dto]);
    return teachers[0];
  }

  async createTeachers(teachers: CreateTeacherDto[]) {
    await this.validateTeachers(teachers);

    const teacherRole = await this.prisma.role.findUnique({
      where: { name: 'TEACHER' },
    });
    if (!teacherRole) {
      throw new BadRequestException(
        'Chưa cấu hình Role TEACHER trong hệ thống',
      );
    }

    const hashedPassword = await bcrypt.hash(
      DEFAULT_PASSWORD,
      BCRYPT_SALT_ROUNDS,
    );

    const createdTeachers = await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const teacher of teachers) {
        const user = await tx.user.create({
          data: {
            email: teacher.email,
            username: teacher.code,
            password_hash: hashedPassword,
            must_change_password: true,
            email_verified_at: null,
            is_active: true,
            user_roles: {
              create: [{ role_id: teacherRole.id }],
            },
          },
        });

        const createdTeacher = await tx.teacher.create({
          data: {
            ...TeacherMapper.toPrismaCreateInput(teacher, user.id),
            status: TeacherStatus.active,
          },
          include: { faculty: true, department: true },
        });

        results.push(createdTeacher);
      }

      return results;
    });

    for (const teacher of createdTeachers) {
      try {
        await this.authService.sendVerificationEmailToUser(teacher.user_id);
        console.log(
          `Verification email sent to ${teacher.email} (${teacher.name})`,
        );
      } catch (error) {
        console.error(
          `Failed to send verification email to ${teacher.email}:`,
          error.message,
        );
      }
    }

    return createdTeachers;
  }

  private async validateTeachers(teachers: CreateTeacherDto[]): Promise<void> {
    this.checkDuplicateInput(teachers);
    await this.checkDuplicateDB(teachers);
  }

  private checkDuplicateInput(teachers: CreateTeacherDto[]): void {
    const codes = new Set<string>();
    const emails = new Set<string>();

    for (const teacher of teachers) {
      if (codes.has(teacher.code)) {
        throw new ConflictException(
          `Mã giảng viên ${teacher.code} bị trùng trong dữ liệu`,
        );
      }
      codes.add(teacher.code);

      if (emails.has(teacher.email)) {
        throw new ConflictException(
          `Email ${teacher.email} bị trùng trong dữ liệu`,
        );
      }
      emails.add(teacher.email);
    }
  }

  private async checkDuplicateDB(teachers: CreateTeacherDto[]): Promise<void> {
    const codes = teachers.map((teacher) => teacher.code);
    const emails = teachers.map((teacher) => teacher.email);

    const [existingTeachers, existingUsers] = await Promise.all([
      this.prisma.teacher.findMany({
        where: {
          OR: [{ teacher_id: { in: codes } }, { email: { in: emails } }],
        },
        select: { teacher_id: true, email: true },
      }),
      this.prisma.user.findMany({
        where: {
          OR: [{ username: { in: codes } }, { email: { in: emails } }],
        },
        select: { username: true, email: true },
      }),
    ]);

    const duplicateCodes = new Set<string>();
    const duplicateEmails = new Set<string>();

    existingTeachers.forEach((teacher) => {
      if (teacher.teacher_id) duplicateCodes.add(teacher.teacher_id);
      if (teacher.email) duplicateEmails.add(teacher.email);
    });
    existingUsers.forEach((user) => {
      if (user.username) duplicateCodes.add(user.username);
      if (user.email) duplicateEmails.add(user.email);
    });

    if (!duplicateCodes.size && !duplicateEmails.size) {
      return;
    }

    const duplicateMessages: string[] = [];
    if (duplicateCodes.size) {
      duplicateMessages.push(
        `Mã giảng viên: ${Array.from(duplicateCodes).join(', ')}`,
      );
    }
    if (duplicateEmails.size) {
      duplicateMessages.push(`Email: ${Array.from(duplicateEmails).join(', ')}`);
    }

    throw new ConflictException(
      ['Các dữ liệu sau đã tồn tại:', ...duplicateMessages].join('\n'),
    );
  }
}
