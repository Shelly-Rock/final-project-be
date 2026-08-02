import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto, ListTeacherQueryDto } from './dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
} from '../../core/utils/pagination.util';
import { TeacherStatus, Prisma } from '@prisma/client';
import { TeacherMapper } from './mapper/teacher.mapper';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextLecturerCode(): Promise<{ code: string }> {
    const lastTeacher = await this.prisma.teacher.findFirst({
      where: { teacher_id: { startsWith: 'GV' } },
      orderBy: { teacher_id: 'desc' },
    });

    if (!lastTeacher) {
      return { code: 'GV001' };
    }

    const lastNumStr = lastTeacher.teacher_id.replace('GV', '');
    const num = parseInt(lastNumStr, 10);

    if (isNaN(num)) {
      return { code: 'GV001' };
    }

    const nextNum = num + 1;
    const nextCode = `GV${String(nextNum).padStart(3, '0')}`;

    return { code: nextCode };
  }

  async create(dto: CreateTeacherDto) {
    const existingTeacher = await this.prisma.teacher.findFirst({
      where: { OR: [{ teacher_id: dto.code }, { email: dto.email }] },
    });

    if (existingTeacher) {
      if (existingTeacher.teacher_id === dto.code) {
        throw new ConflictException('Mã giảng viên đã tồn tại');
      }
      throw new ConflictException('Email đã được sử dụng');
    }

    const teacherRole = await this.prisma.role.findUnique({
      where: { name: 'TEACHER' },
    });
    if (!teacherRole)
      throw new BadRequestException(
        'Chưa cấu hình Role TEACHER trong hệ thống',
      );

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.code,
          password_hash: 'hashed_default_password',
          role_id: teacherRole.id,
        },
      });
      const newTeacher = await tx.teacher.create({
        data: {
          ...TeacherMapper.toPrismaCreateInput(dto, newUser.id),
          status: TeacherStatus.active,
        },
      });

      return newTeacher;
    });
  }

  async findAll(query: ListTeacherQueryDto) {
    const { search, facultyId, departmentId, status, page, pageSize } = query;
    const { skip, take } = getPaginationOptions(page, pageSize);

    const where: Prisma.TeacherWhereInput = {
      deleted_at: null,
    };

    if (status) where.status = status;
    if (facultyId) where.faculty_id = facultyId;
    if (departmentId) where.department_id = departmentId;

    if (search) {
      where.OR = [
        { teacher_id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.teacher.count({ where }),
      this.prisma.teacher.findMany({
        where,
        skip,
        take,
        include: { faculty: true, department: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return formatPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(teacherCode: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { teacher_id: teacherCode },
      include: { faculty: true, department: true },
    });

    if (!teacher || teacher.deleted_at) {
      throw new NotFoundException(
        `Không tìm thấy giảng viên với mã: ${teacherCode}`,
      );
    }

    return teacher;
  }

  async update(teacherCode: string, dto: UpdateTeacherDto) {
    const currentTeacher = await this.findOne(teacherCode);

    const dataToUpdate = TeacherMapper.toPrismaUpdateInput(dto);

    return this.prisma.teacher.update({
      where: { id: currentTeacher.id },
      data: dataToUpdate,
    });
  }

  async toggleStatus(teacherCode: string, newStatus: TeacherStatus) {
    const teacher = await this.findOne(teacherCode);

    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: { status: newStatus },
    });
  }

  async remove(teacherCode: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { teacher_id: teacherCode },
      include: { project: true },
    });

    if (!teacher || teacher.deleted_at) {
      throw new NotFoundException(
        `Không tìm thấy giảng viên với mã: ${teacherCode}`,
      );
    }

    if (teacher.project && teacher.project.length > 0) {
      throw new BadRequestException(
        'Không thể xóa: giảng viên đang có đề tài hoạt động',
      );
    }

    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        status: TeacherStatus.inactive,
        deleted_at: new Date(),
      },
    });
  }
}
