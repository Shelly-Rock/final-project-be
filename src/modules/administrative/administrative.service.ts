import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
import { FacultyResponseDto } from './dto/faculty.response.dto';
import { DepartmentResponseDto } from './dto/department.response.dto';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';

type FacultyRecord = {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

@Injectable()
export class AdministrativeService {
  constructor(private readonly prisma: PrismaService) {}

  private mapFaculty(faculty: FacultyRecord): FacultyResponseDto {
    return {
      id: faculty.id,
      name: faculty.name,
      description: faculty.description ?? null,
      isActive: faculty.is_active ?? true,
      createdAt: faculty.created_at,
      updatedAt: faculty.updated_at,
    };
  }

  async getFaculties(
    search?: string,
    isActive?: string,
  ): Promise<FacultyResponseDto[]> {
    const trimmedSearch = search?.trim();
    const activeFilter =
      isActive === undefined ? undefined : isActive === 'true' ? true : false;

    const faculties = await this.prisma.faculty.findMany({
      where: {
        ...(trimmedSearch
          ? {
              OR: [
                { id: { contains: trimmedSearch, mode: 'insensitive' } },
                { name: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(activeFilter === undefined ? {} : { is_active: activeFilter }),
      },
      orderBy: { created_at: 'desc' },
    });

    return faculties.map((f) => this.mapFaculty(f));
  }

  async getFacultyById(id: string): Promise<FacultyResponseDto> {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');
    return this.mapFaculty(faculty);
  }

  async createFaculty(dto: CreateFacultyDto): Promise<FacultyResponseDto> {
    const id = dto.id.trim();
    const name = dto.name.trim();
    const description = dto.description?.trim() || null;

    const exists = await this.prisma.faculty.findUnique({ where: { id } });
    if (exists) throw new ConflictException('Mã khoa đã tồn tại');

    const faculty = await this.prisma.faculty.create({
      data: {
        id,
        name,
        description,
        is_active: dto.isActive ?? true,
      },
    });

    return this.mapFaculty(faculty);
  }

  async updateFaculty(
    id: string,
    dto: UpdateFacultyDto,
    currentUser: JwtUser,
  ): Promise<FacultyResponseDto> {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');

    const role = currentUser.role?.toUpperCase();
    if (role !== 'ADMIN') {
      await this.assertSecretaryCanUpdateFaculty(currentUser, id);
    }

    const data: {
      name?: string;
      description?: string | null;
      is_active?: boolean;
    } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Tên khoa không được để trống');
      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.isActive !== undefined) {
      data.is_active = dto.isActive;
    }

    const updated = await this.prisma.faculty.update({
      where: { id },
      data,
    });

    return this.mapFaculty(updated);
  }

  async deleteFaculty(id: string): Promise<{ message: string }> {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');

    const [departmentCount, teacherCount] = await Promise.all([
      this.prisma.department.count({ where: { faculty_id: id } }),
      this.prisma.teacher.count({
        where: { faculty_id: id, deleted_at: null },
      }),
    ]);

    if (departmentCount > 0) {
      throw new ConflictException('Không thể xóa khoa đang có bộ môn');
    }

    if (teacherCount > 0) {
      throw new ConflictException('Không thể xóa khoa đang có giảng viên');
    }

    await this.prisma.faculty.delete({ where: { id } });
    return { message: 'Đã xóa khoa' };
  }

  private async assertSecretaryCanUpdateFaculty(user: JwtUser, facultyId: string) {
    const secretary = await this.prisma.secretary.findUnique({
      where: { user_id: Number(user.sub) },
      include: { department: { select: { faculty_id: true } } },
    });

    if (secretary?.department?.faculty_id !== facultyId) {
      throw new ForbiddenException('Bạn không có quyền cập nhật khoa này');
    }
  }

  async getDepartments(facultyId?: string): Promise<DepartmentResponseDto[]> {
    const where = facultyId ? { faculty_id: facultyId } : {};

    const departments = await this.prisma.department.findMany({
      where,
      select: { id: true, name: true, faculty_id: true },
      orderBy: { id: 'asc' },
    });

    return departments.map((d) => ({
      id: d.id,
      name: d.name,
      facultyId: d.faculty_id,
    }));
  }
}
