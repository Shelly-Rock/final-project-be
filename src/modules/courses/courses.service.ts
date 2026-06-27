import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException(`Course with code "${data.code}" already exists`);
    }

    return this.prisma.course.create({
      data,
      include: { _count: { select: { classes: true } } },
    });
  }

  async findAll(params?: { skip?: number; take?: number; search?: string; isActive?: boolean }) {
    const { skip = 0, take = 100, search, isActive } = params || {};

    const where: Prisma.CourseWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) where.isActive = isActive;

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { year: 'desc' },
        include: { _count: { select: { classes: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);

    return { data: courses, total, skip, take };
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        classes: { select: { id: true, code: true, name: true, _count: { select: { users: true } } } },
        _count: { select: { classes: true } },
      },
    });

    if (!course) throw new NotFoundException(`Course with ID ${id} not found`);
    return course;
  }

  async update(id: string, data: UpdateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Course with ID ${id} not found`);

    return this.prisma.course.update({
      where: { id },
      data,
      include: { _count: { select: { classes: true } } },
    });
  }

  async delete(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { classes: true } } },
    });

    if (!course) throw new NotFoundException(`Course with ID ${id} not found`);
    if (course._count.classes > 0) {
      throw new ConflictException(`Cannot delete course with ${course._count.classes} associated classes`);
    }

    await this.prisma.course.delete({ where: { id } });
    return { message: 'Course deleted successfully' };
  }
}
