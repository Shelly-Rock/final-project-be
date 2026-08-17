import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { GetListStudentRespDTO } from '@/modules/student/dto';

@Injectable()
export class GetStudentByIdService {
  constructor(private readonly prismaService: PrismaService) {}

  async getStudentById(id: number): Promise<GetListStudentRespDTO> {
    const student = await this.prismaService.student.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            teacher_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!student || student.deleted_at) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID: ${id}`);
    }

    return this.mapToResponseDTO(student);
  }

  async getStudentByStudentId(studentId: string): Promise<GetListStudentRespDTO> {
    const student = await this.prismaService.student.findUnique({
      where: { student_id: studentId },
      include: {
        teacher: {
          select: {
            id: true,
            teacher_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!student || student.deleted_at) {
      throw new NotFoundException(
        `Không tìm thấy sinh viên với mã: ${studentId}`,
      );
    }

    return this.mapToResponseDTO(student);
  }

  private mapToResponseDTO(student: any): GetListStudentRespDTO {
    return {
      id: student.id,
      studentId: student.student_id,
      email: student.email,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
      dateOfBirth: student.date_of_birth,
      gender: student.gender,
      className: student.class_name,
      major: student.major,
      courseYear: student.course_year,
      academicYear: student.academic_year,
      extraData: student.extra_data,
      createdAt: student.created_at.toISOString(),
      updatedAt: student.updated_at.toISOString(),
      teacher: student.teacher,
    };
  }
}
