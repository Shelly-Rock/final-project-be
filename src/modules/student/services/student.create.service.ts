import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreateStudentService {
  constructor(private readonly prismaSV: PrismaService) {}

  async createStudent(students: CreateStudentReqDTO[]): Promise<void> {
    const studentData = students.map((student) => ({
      student_id: student.studentId,
      email: student.email,
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
