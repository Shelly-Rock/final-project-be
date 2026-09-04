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

    if (!student || student.deleted_at) {
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

  async removeStudent(id: number, hardDelete = false) {
    const student = await this.getStudentById(id);

    const hasActiveProject = student.project && !student.project.deleted_at;
    const hasFinalSubmission = !!student.final_submissions;

    if (hardDelete) {
      if (hasActiveProject) {
        throw new BadRequestException(
          'Không thể xóa vĩnh viễn: sinh viên đang có đề tài hoạt động',
        );
      }

      if (hasFinalSubmission) {
        throw new BadRequestException(
          'Không thể xóa vĩnh viễn: sinh viên đã có bài nộp cuối kỳ',
        );
      }

      await this.prismaService.student.delete({
        where: { id },
      });

      return {
        id,
        studentId: student.student_id,
        deleted: true,
        hardDelete: true,
        message: 'Xóa sinh viên vĩnh viễn thành công',
      };
    }

    await this.prismaService.student.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      id,
      studentId: student.student_id,
      deleted: true,
      hardDelete: false,
      message: 'Xóa sinh viên thành công (soft delete)',
    };
  }

  async removeStudents(ids: number[], hardDelete = false) {
    const uniqueIds = [...new Set(ids)];

    return this.prismaService.$transaction(async (transaction) => {
      const students = await transaction.student.findMany({
        where: { id: { in: uniqueIds }, deleted_at: null },
        include: { project: true, final_submissions: true },
      });

      if (students.length !== uniqueIds.length) {
        const foundIds = new Set(students.map((student) => student.id));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Không tìm thấy sinh viên với ID: ${missingIds.join(', ')}`,
        );
      }

      if (hardDelete) {
        const blockedStudent = students.find(
          (student) =>
            (student.project && !student.project.deleted_at) ||
            student.final_submissions,
        );
        if (blockedStudent) {
          throw new BadRequestException(
            `Không thể xóa vĩnh viễn sinh viên ${blockedStudent.student_id}: sinh viên đang có dữ liệu liên quan`,
          );
        }
        await transaction.student.deleteMany({
          where: { id: { in: uniqueIds } },
        });
      } else {
        await transaction.student.updateMany({
          where: { id: { in: uniqueIds } },
          data: { deleted_at: new Date() },
        });
      }

      return {
        ids: uniqueIds,
        count: uniqueIds.length,
        deleted: true,
        hardDelete,
        message: hardDelete
          ? 'Xóa vĩnh viễn sinh viên thành công'
          : 'Xóa sinh viên thành công (soft delete)',
      };
    });
  }
}
