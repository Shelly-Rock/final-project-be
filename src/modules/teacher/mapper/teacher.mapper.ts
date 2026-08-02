import { Prisma } from '@prisma/client';
import { CreateTeacherDto, UpdateTeacherDto } from '../dto';

export class TeacherMapper {
  static toPrismaCreateInput(
    dto: CreateTeacherDto,
    userId: number,
  ): Prisma.TeacherCreateInput {
    return {
      teacher_id: dto.code,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      faculty: { connect: { id: dto.facultyId } },
      department: { connect: { id: dto.departmentId } },

      academic_title: dto.academicTitle,
      position: dto.position,
      date_of_birth: dto.dateOfBirth,
      gender: dto.gender,
      address: dto.address,
      user: { connect: { id: userId } },
    };
  }

  static toPrismaUpdateInput(dto: UpdateTeacherDto): Prisma.TeacherUpdateInput {
    const data: Prisma.TeacherUpdateInput = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      academic_title: dto.academicTitle,
      position: dto.position,
      date_of_birth: dto.dateOfBirth,
      gender: dto.gender,
      address: dto.address,
    };

    if (dto.facultyId) {
      data.faculty = { connect: { id: dto.facultyId } };
    }
    if (dto.departmentId) {
      data.department = { connect: { id: dto.departmentId } };
    }

    return data;
  }
}
