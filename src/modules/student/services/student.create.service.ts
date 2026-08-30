import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import { AuthService } from '@/modules/auth/auth.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = '1111';

@Injectable()
export class CreateStudentService {
  constructor(
    private readonly prismaSV: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async createStudent(students: CreateStudentReqDTO[]): Promise<void> {
    // Bước 1: Lấy STUDENT role
    const studentRole = await this.prismaSV.role.findUnique({
      where: { name: 'STUDENT' },
    });

    if (!studentRole) {
      throw new Error('STUDENT role not found. Please seed the database first.');
    }

    // Bước 2: Hash password mặc định
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_SALT_ROUNDS);

    // Bước 3: Tạo Users với email verification pending
    const userData = students.map((student) => ({
      email: student.email,
      username: student.studentId,
      password_hash: hashedPassword,
      must_change_password: true,
      email_verified_at: null,
      is_active: true,
    }));

    // Tạo users trước
    const createdUsers = await this.prismaSV.user.createManyAndReturn({
      data: userData,
    });

    await this.prismaSV.userRole.createMany({
      data: createdUsers.map((user) => ({
        user_id: user.id,
        role_id: studentRole.id,
      })),
    });

    // Bước 4: Tạo Students với user_id từ users vừa tạo
    const studentData = students.map((student, index) => ({
      user_id: createdUsers[index].id,
      student_id: student.studentId,
      first_name: student.firstName,
      middle_name: student.middleName,
      last_name: student.lastName,
      date_of_birth: new Date(student.dateOfBirth),
      gender: student.gender,
      class_name: student.className,
      major: student.major,
      course_year: student.courseYear,
      academic_year: student.academicYear,
      extra_data: (student.extraData as Prisma.InputJsonValue) ?? null,
    }));

    await this.prismaSV.student.createMany({
      data: studentData,
    });

    // Bước 5: Gửi email verification cho từng sinh viên
    for (let i = 0; i < createdUsers.length; i++) {
      const student = students[i];
      const fullName = `${student.lastName} ${student.middleName} ${student.firstName}`.trim();
      
      try {
        await this.authService.sendVerificationEmailToUser(createdUsers[i].id);
        console.log(`Verification email sent to ${student.email} (${fullName})`);
      } catch (error) {
        console.error(`Failed to send verification email to ${student.email}:`, error.message);
      }
    }
  }
}
