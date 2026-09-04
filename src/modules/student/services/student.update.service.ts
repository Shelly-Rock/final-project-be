import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { UpdateStudentReqDTO } from '@/modules/student/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UpdateStudentService {
  constructor(private readonly prismaService: PrismaService) {}

  async getStudentById(id: number) {
    const student = await this.prismaService.student.findUnique({
      where: { id },
    });

    if (!student || student.deleted_at) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID: ${id}`);
    }

    return student;
  }

  async getStudentByStudentId(studentId: string) {
    const student = await this.prismaService.student.findUnique({
      where: { student_id: studentId },
    });

    if (!student || student.deleted_at) {
      throw new NotFoundException(
        `Không tìm thấy sinh viên với mã: ${studentId}`,
      );
    }

    return student;
  }

  async updateStudent(
    id: number,
    dto: UpdateStudentReqDTO,
  ): Promise<{
    id: number;
    studentId: string;
    email: string;
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: string;
    className: string;
    major: string;
    courseYear: number;
    academicYear: string;
  }> {
    const student = await this.getStudentById(id);

    const updateData: Prisma.StudentUpdateInput = {};

    if (dto.firstName !== undefined) updateData.first_name = dto.firstName;
    if (dto.middleName !== undefined) updateData.middle_name = dto.middleName;
    if (dto.lastName !== undefined) updateData.last_name = dto.lastName;
    if (dto.dateOfBirth !== undefined)
      updateData.date_of_birth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.className !== undefined) updateData.class_name = dto.className;
    if (dto.major !== undefined) updateData.major = dto.major;
    if (dto.courseYear !== undefined) updateData.course_year = dto.courseYear;
    if (dto.academicYear !== undefined)
      updateData.academic_year = dto.academicYear;
    if (dto.extraData !== undefined)
      updateData.extra_data = dto.extraData as Prisma.InputJsonValue;

    if (dto.email && dto.email !== student.email) {
      const existingUser = await this.prismaService.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUser && existingUser.id !== student.user_id) {
        throw new ConflictException('Email đã được sử dụng');
      }
      updateData.email = dto.email;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Không có thông tin nào để cập nhật');
    }

    const updated = await this.prismaService.$transaction(
      async (transaction) => {
        const updatedStudent = await transaction.student.update({
          where: { id },
          data: updateData,
        });
        if (dto.email && student.user_id && dto.email !== student.email) {
          await transaction.user.update({
            where: { id: student.user_id },
            data: { email: dto.email },
          });
        }
        return updatedStudent;
      },
    );

    return {
      id: updated.id,
      studentId: updated.student_id,
      email: updated.email,
      firstName: updated.first_name,
      middleName: updated.middle_name,
      lastName: updated.last_name,
      dateOfBirth: updated.date_of_birth,
      gender: updated.gender,
      className: updated.class_name,
      major: updated.major,
      courseYear: updated.course_year,
      academicYear: updated.academic_year,
    };
  }
}
