import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException(`Department with code "${data.code}" already exists`);
    }

    return this.prisma.department.create({
      data,
      include: { _count: { select: { users: true, majors: true } } },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 100, search, isActive } = params || {};

    const where: Prisma.DepartmentWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { users: true, majors: true } },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data: departments.map((dept) => ({
        ...dept,
        userCount: dept._count.users,
        majorCount: dept._count.majors,
      })),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true } },
        majors: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true, majors: true } },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return {
      ...department,
      userCount: department._count.users,
      majorCount: department._count.majors,
    };
  }

  async findByCode(code: string) {
    const department = await this.prisma.department.findUnique({
      where: { code },
      include: { _count: { select: { users: true, majors: true } } },
    });

    if (!department) {
      throw new NotFoundException(`Department with code "${code}" not found`);
    }

    return department;
  }

  async update(id: string, data: UpdateDepartmentDto) {
    const department = await this.prisma.department.findUnique({ where: { id } });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    if (data.code && data.code !== department.code) {
      const existing = await this.prisma.department.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw new ConflictException(`Department with code "${data.code}" already exists`);
      }
    }

    return this.prisma.department.update({
      where: { id },
      data,
      include: { _count: { select: { users: true, majors: true } } },
    });
  }

  async delete(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true, majors: true } } },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    if (department._count.users > 0) {
      throw new ConflictException(
        `Cannot delete department with ${department._count.users} associated users`,
      );
    }

    if (department._count.majors > 0) {
      throw new ConflictException(
        `Cannot delete department with ${department._count.majors} associated majors`,
      );
    }

    await this.prisma.department.delete({ where: { id } });

    return { message: 'Department deleted successfully' };
  }

  async importDepartments(data: Array<{ code: string; name: string }>) {
    const results = {
      created: [] as string[],
      updated: [] as string[],
      errors: [] as string[],
    };

    for (const item of data) {
      try {
        const existing = await this.prisma.department.findUnique({
          where: { code: item.code },
        });

        if (existing) {
          await this.prisma.department.update({
            where: { id: existing.id },
            data: { name: item.name },
          });
          results.updated.push(item.code);
        } else {
          await this.prisma.department.create({
            data: { code: item.code, name: item.name },
          });
          results.created.push(item.code);
        }
      } catch (error) {
        results.errors.push(`${item.code}: ${error.message}`);
      }
    }

    return results;
  }
}
