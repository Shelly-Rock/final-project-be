import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { FacultyResponseDto } from './dto/faculty.response.dto';
import { DepartmentResponseDto } from './dto/department.response.dto';

@Injectable()
export class AdministrativeService {
  constructor(private readonly prisma: PrismaService) {}

  async getFaculties(): Promise<FacultyResponseDto[]> {
    const faculties = await this.prisma.faculty.findMany({
      select: { id: true, name: true },
    });

    return faculties.map((f) => ({
      id: f.id,
      name: f.name,
    }));
  }

  async getDepartments(facultyId?: string): Promise<DepartmentResponseDto[]> {
    const where = facultyId ? { faculty_id: facultyId } : {};

    const departments = await this.prisma.department.findMany({
      where,
      select: { id: true, name: true, faculty_id: true },
    });

    return departments.map((d) => ({
      id: d.id,
      name: d.name,
      facultyId: d.faculty_id,
    }));
  }
}
