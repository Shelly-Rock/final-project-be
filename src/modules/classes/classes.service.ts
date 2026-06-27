import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClassDto) {
    const existing = await this.prisma.class.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException(`Class with code "${data.code}" already exists`);
    }

    const [major, course] = await Promise.all([
      this.prisma.major.findUnique({ where: { id: data.majorId } }),
      this.prisma.course.findUnique({ where: { id: data.courseId } }),
    ]);

    if (!major) throw new NotFoundException(`Major with ID ${data.majorId} not found`);
    if (!course) throw new NotFoundException(`Course with ID ${data.courseId} not found`);

    return this.prisma.class.create({
      data,
      include: {
        major: { select: { id: true, code: true, name: true } },
        course: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    search?: string;
    majorId?: string;
    courseId?: string;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 100, search, majorId, courseId, isActive } = params || {};

    const where: Prisma.ClassWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (majorId) where.majorId = majorId;
    if (courseId) where.courseId = courseId;
    if (isActive !== undefined) where.isActive = isActive;

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          major: { select: { id: true, code: true, name: true } },
          course: { select: { id: true, code: true, name: true } },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return { data: classes, total, skip, take };
  }

  async findOne(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        major: true,
        course: true,
        _count: { select: { users: true } },
      },
    });

    if (!classEntity) throw new NotFoundException(`Class with ID ${id} not found`);
    return classEntity;
  }

  async update(id: string, data: UpdateClassDto) {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Class with ID ${id} not found`);

    if (data.majorId) {
      const major = await this.prisma.major.findUnique({ where: { id: data.majorId } });
      if (!major) throw new NotFoundException(`Major with ID ${data.majorId} not found`);
    }

    if (data.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
      if (!course) throw new NotFoundException(`Course with ID ${data.courseId} not found`);
    }

    return this.prisma.class.update({
      where: { id },
      data,
      include: {
        major: { select: { id: true, code: true, name: true } },
        course: { select: { id: true, code: true, name: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async delete(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!classEntity) throw new NotFoundException(`Class with ID ${id} not found`);
    if (classEntity._count.users > 0) {
      throw new ConflictException(`Cannot delete class with ${classEntity._count.users} associated users`);
    }

    await this.prisma.class.delete({ where: { id } });
    return { message: 'Class deleted successfully' };
  }

  async importClasses(data: Array<{ code: string; name: string; majorCode: string; courseCode: string }>) {
    const results = { created: [] as string[], updated: [] as string[], errors: [] as string[] };

    for (const item of data) {
      try {
        const [major, course] = await Promise.all([
          this.prisma.major.findUnique({ where: { code: item.majorCode } }),
          this.prisma.course.findUnique({ where: { code: item.courseCode } }),
        ]);

        if (!major) {
          results.errors.push(`${item.code}: Major "${item.majorCode}" not found`);
          continue;
        }
        if (!course) {
          results.errors.push(`${item.code}: Course "${item.courseCode}" not found`);
          continue;
        }

        const existing = await this.prisma.class.findUnique({ where: { code: item.code } });

        if (existing) {
          await this.prisma.class.update({
            where: { id: existing.id },
            data: { name: item.name, majorId: major.id, courseId: course.id },
          });
          results.updated.push(item.code);
        } else {
          await this.prisma.class.create({
            data: { code: item.code, name: item.name, majorId: major.id, courseId: course.id },
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
