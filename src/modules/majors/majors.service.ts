import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMajorDto, UpdateMajorDto } from './dto/major.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MajorsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMajorDto) {
    const existing = await this.prisma.major.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException(`Major with code "${data.code}" already exists`);
    }

    const department = await this.prisma.department.findUnique({
      where: { id: data.departmentId },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${data.departmentId} not found`);
    }

    return this.prisma.major.create({
      data,
      include: {
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true, classes: true, thesisTopics: true } },
      },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    search?: string;
    departmentId?: string;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 100, search, departmentId, isActive } = params || {};

    const where: Prisma.MajorWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [majors, total] = await Promise.all([
      this.prisma.major.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          department: { select: { id: true, code: true, name: true } },
          _count: { select: { users: true, classes: true } },
        },
      }),
      this.prisma.major.count({ where }),
    ]);

    return {
      data: majors,
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const major = await this.prisma.major.findUnique({
      where: { id },
      include: {
        department: true,
        classes: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true, classes: true, thesisTopics: true } },
      },
    });

    if (!major) {
      throw new NotFoundException(`Major with ID ${id} not found`);
    }

    return major;
  }

  async update(id: string, data: UpdateMajorDto) {
    const major = await this.prisma.major.findUnique({ where: { id } });

    if (!major) {
      throw new NotFoundException(`Major with ID ${id} not found`);
    }

    if (data.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!department) {
        throw new NotFoundException(`Department with ID ${data.departmentId} not found`);
      }
    }

    return this.prisma.major.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true, classes: true } },
      },
    });
  }

  async delete(id: string) {
    const major = await this.prisma.major.findUnique({
      where: { id },
      include: { _count: { select: { users: true, classes: true } } },
    });

    if (!major) {
      throw new NotFoundException(`Major with ID ${id} not found`);
    }

    if (major._count.users > 0) {
      throw new ConflictException(`Cannot delete major with ${major._count.users} associated users`);
    }

    await this.prisma.major.delete({ where: { id } });
    return { message: 'Major deleted successfully' };
  }

  async importMajors(data: Array<{ code: string; name: string; departmentCode: string }>) {
    const results = { created: [] as string[], updated: [] as string[], errors: [] as string[] };

    for (const item of data) {
      try {
        const department = await this.prisma.department.findUnique({
          where: { code: item.departmentCode },
        });

        if (!department) {
          results.errors.push(`${item.code}: Department "${item.departmentCode}" not found`);
          continue;
        }

        const existing = await this.prisma.major.findUnique({ where: { code: item.code } });

        if (existing) {
          await this.prisma.major.update({
            where: { id: existing.id },
            data: { name: item.name, departmentId: department.id },
          });
          results.updated.push(item.code);
        } else {
          await this.prisma.major.create({
            data: { code: item.code, name: item.name, departmentId: department.id },
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
