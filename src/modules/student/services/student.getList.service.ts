import { PrismaService } from '@core/index';
import { Injectable } from '@nestjs/common';
import { GetListStudentsRespDTO } from '@/modules/student/dto';
import { PaginationReqDTO } from '@/shared';
@Injectable()
export class GetStudentListService {
  constructor(private readonly prismaService: PrismaService) {}
  async getStudentList(
    query: PaginationReqDTO,
  ): Promise<GetListStudentsRespDTO> {
    const { page = 1, limit = 10 } = query;
    const [students, total] = await Promise.all([
      this.prismaService.student.findMany({
        where: { deleted_at: null },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      }),
      this.prismaService.student.count({ where: { deleted_at: null } }),
    ]);

    const studentsDTO = students.map((student) => ({
      id: student.id,
      studentId: student.student_id,
      email: student.user?.email || null,
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
    }));
    const totalPages = Math.ceil(total / limit);

    return { students: studentsDTO, total, page, limit, totalPages };
  }
}
