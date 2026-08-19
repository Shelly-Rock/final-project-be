import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreateStudentService {
  constructor(private readonly prismaSV: PrismaService) {}

  async createStudent(students: CreateStudentReqDTO[]): Promise<void> {
    // Bước 1: Tạo Users trước (với email làm Single Source of Truth)
    const userData = students.map((student) => ({
      email: student.email,
      username: student.studentId,
      password_hash: '', // Sẽ được set sau
      role_id: 3, // Student role - cần confirm role_id đúng
    }));

    // Tạo users trước
    const createdUsers = await this.prismaSV.user.createManyAndReturn({
      data: userData,
    });

    // Bước 2: Tạo Students với user_id từ users vừa tạo
    const studentData = students.map((student, index) => ({
      user_id: createdUsers[index].id,
      student_id: student.studentId,
      // Bỏ email ở đây - dùng user.email
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
  }
}
