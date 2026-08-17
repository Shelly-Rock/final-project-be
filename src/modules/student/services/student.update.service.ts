import {
  Injectable,
  NotFoundException,
  ConflictException,
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
  ): Promise<{ id: number; studentId: string }> {
    await this.getStudentById(id);

    if (dto.email) {
      const existingWithEmail = await this.prismaService.student.findFirst({
        where: {
          email: dto.email,
          id: { not: id },
          deleted_at: null,
        },
      });

      if (existingWithEmail) {
        throw new ConflictException('Email đã được sử dụng bởi sinh viên khác');
      }
    }

    const updateData: Prisma.StudentUpdateInput = {};

    if (dto.email !== undefined) updateData.email = dto.email;
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

    const updated = await this.prismaService.student.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      studentId: updated.student_id,
    };
  }
}
