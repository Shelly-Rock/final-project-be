import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';

@Injectable()
export class RemoveStudentService {
  constructor(private readonly prismaService: PrismaService) {}

  async getStudentById(id: number) {
    const student = await this.prismaService.student.findUnique({
      where: { id },
      include: {
        project: true,
        final_submissions: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID: ${id}`);
    }

    return student;
  }

  async getStudentByStudentId(studentId: string) {
    const student = await this.prismaService.student.findUnique({
      where: { student_id: studentId },
      include: {
        project: true,
        final_submissions: true,
      },
    });

    if (!student || student.deleted_at) {
      throw new NotFoundException(
        `Không tìm thấy sinh viên với mã: ${studentId}`,
      );
    }

    return student;
  }

  async removeStudent(id: number) {
    const student = await this.getStudentById(id);

    const hasActiveProject = student.project && !student.project.deleted_at;
    const hasFinalSubmission = !!student.final_submissions;

    if (hasActiveProject) {
      throw new BadRequestException(
        'Không thể xóa: sinh viên đang có đề tài hoạt động',
      );
    }

    if (hasFinalSubmission) {
      throw new BadRequestException(
        'Không thể xóa: sinh viên đã có bài nộp cuối kỳ',
      );
    }

    await this.prismaService.student.delete({ where: { id } });

    return {
      id,
      studentId: student.student_id,
      deleted: true,
      message: 'Xóa sinh viên vĩnh viễn thành công',
    };
  }

  async removeStudents(ids: number[]) {
    const uniqueIds = [...new Set(ids)];

    return this.prismaService.$transaction(async (transaction) => {
      const students = await transaction.student.findMany({
        where: { id: { in: uniqueIds } },
        include: { project: true, final_submissions: true },
      });

      if (students.length !== uniqueIds.length) {
        const foundIds = new Set(students.map((student) => student.id));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Không tìm thấy sinh viên với ID: ${missingIds.join(', ')}`,
        );
      }

      const blockedStudent = students.find(
        (student) =>
          (student.project && !student.project.deleted_at) ||
          student.final_submissions,
      );
      if (blockedStudent) {
        throw new BadRequestException(
          `Không thể xóa sinh viên ${blockedStudent.student_id}: sinh viên đang có dữ liệu liên quan`,
        );
      }

      await transaction.student.deleteMany({
        where: { id: { in: uniqueIds } },
      });

      return {
        ids: uniqueIds,
        count: uniqueIds.length,
        deleted: true,
        message: 'Xóa sinh viên vĩnh viễn thành công',
      };
    });
  }
}
