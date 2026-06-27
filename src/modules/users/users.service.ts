import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictException(`User with email "${data.email}" already exists`);
    }

    if (data.mssv) {
      const existingMssv = await this.prisma.user.findUnique({
        where: { mssv: data.mssv },
      });
      if (existingMssv) {
        throw new ConflictException(`User with MSSV "${data.mssv}" already exists`);
      }
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    return this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        mssv: data.mssv,
        role: data.role || Role.STUDENT,
        isActive: data.isActive ?? true,
        departmentId: data.departmentId,
        majorId: data.majorId,
        classId: data.classId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        mssv: true,
        role: true,
        isActive: true,
        department: { select: { id: true, code: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
        class: { select: { id: true, code: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(params?: any) {
    const { skip = 0, take = 100, search, role, isActive, departmentId, majorId, classId } = params || {};

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { mssv: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (departmentId) where.departmentId = departmentId;
    if (majorId) where.majorId = majorId;
    if (classId) where.classId = classId;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          mssv: true,
          role: true,
          isActive: true,
          department: { select: { id: true, code: true, name: true } },
          major: { select: { id: true, code: true, name: true } },
          class: { select: { id: true, code: true, name: true } },
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, skip, take };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        mssv: true,
        role: true,
        isActive: true,
        department: true,
        major: true,
        class: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { supervisedTopics: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        mssv: true,
        role: true,
        isActive: true,
        department: { select: { id: true, code: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
        class: { select: { id: true, code: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { supervisedTopics: true, registrations: true } } },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user._count.supervisedTopics > 0) {
      throw new ConflictException(`Cannot delete user with ${user._count.supervisedTopics} supervised topics`);
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async findTeachers() {
    return this.prisma.user.findMany({
      where: { role: Role.TEACHER, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        department: { select: { name: true } },
        _count: {
          select: {
            supervisedTopics: {
              where: { status: { in: ['PENDING_APPROVAL', 'APPROVED'] } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findStudents(params?: { majorId?: string; classId?: string }) {
    const where: Prisma.UserWhereInput = { role: Role.STUDENT, isActive: true };
    if (params?.majorId) where.majorId = params.majorId;
    if (params?.classId) where.classId = params.classId;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        mssv: true,
        class: { select: { name: true } },
        major: { select: { name: true } },
      },
      orderBy: [{ mssv: 'asc' }, { name: 'asc' }],
    });
  }

  async importUsersFromExcel(data: Array<Record<string, any>>) {
    const results = {
      created: [] as string[],
      updated: [] as string[],
      errors: [] as string[],
    };

    const defaultPassword = '123456';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const email = row['email'] || row['Email'] || row['EMAIL'] || '';
      const name = row['name'] || row['Name'] || row['NAME'] || '';
      const mssv = row['mssv'] || row['Mssv'] || row['MSSV'] || '';
      const role = (row['role'] || row['Role'] || row['ROLE'] || 'STUDENT') as Role;

      try {
        if (!email || !this.isValidEmail(email)) {
          results.errors.push(`Row ${i + 2}: Invalid email`);
          continue;
        }

        const existing = await this.prisma.user.findUnique({ where: { email } });

        if (existing) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              name: name || existing.name,
              mssv: mssv || existing.mssv,
              role: Object.values(Role).includes(role) ? role : existing.role,
            },
          });
          results.updated.push(email);
        } else {
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          await this.prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              name: name || null,
              mssv: mssv || null,
              role: Object.values(Role).includes(role) ? role : Role.STUDENT,
              isActive: true,
            },
          });
          results.created.push(email);
        }
      } catch (error: any) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    return results;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
