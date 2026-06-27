import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRegistrationDto, BulkRegistrationDto, RegistrationQueryDto } from './dto/registration.dto';
import { Prisma, RegistrationStatus, TopicStatus } from '@prisma/client';

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateRegistrationDto, studentId: string) {
    // Check topic exists and is approved
    const topic = await this.prisma.thesisTopic.findUnique({
      where: { id: data.topicId },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID ${data.topicId} not found`);
    }

    if (topic.status !== TopicStatus.APPROVED) {
      throw new BadRequestException('Topic is not available for registration');
    }

    // Check deadline
    if (topic.deadline && new Date() > topic.deadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    // Check if already registered
    const existing = await this.prisma.registration.findFirst({
      where: {
        studentId,
        topicId: data.topicId,
        status: { in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED] },
      },
    });

    if (existing) {
      throw new ConflictException('You have already registered for this topic');
    }

    // Check max students
    const approvedCount = await this.prisma.registration.count({
      where: {
        topicId: data.topicId,
        status: RegistrationStatus.APPROVED,
      },
    });

    if (approvedCount >= topic.maxStudents) {
      throw new BadRequestException('Topic has reached maximum student capacity');
    }

    // Check student's existing registrations
    const studentRegistrations = await this.prisma.registration.findMany({
      where: {
        studentId,
        status: { in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED] },
      },
    });

    if (studentRegistrations.length >= 3) {
      throw new BadRequestException('You have reached maximum registration limit (3 topics)');
    }

    // For multiple order choice
    if (data.orderChoice && topic.isMultipleOrder) {
      // Check if already registered with same order choice
      const existingOrder = await this.prisma.registration.findFirst({
        where: {
          studentId,
          topicId: data.topicId,
          orderChoice: data.orderChoice,
        },
      });

      if (existingOrder) {
        throw new ConflictException('You already have a registration with this order choice');
      }
    }

    return this.prisma.registration.create({
      data: {
        ...data,
        studentId,
        orderChoice: data.orderChoice || 1,
      },
      include: {
        student: { select: { id: true, mssv: true, name: true, email: true } },
        topic: {
          select: {
            id: true,
            code: true,
            title: true,
            supervisor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async bulkCreate(data: BulkRegistrationDto, studentId: string) {
    const results = { created: [] as any[], errors: [] as any[] };

    for (const reg of data.registrations) {
      try {
        const created = await this.create(
          { topicId: reg.topicId, orderChoice: reg.orderChoice, priorityReason: reg.priorityReason },
          studentId,
        );
        results.created.push(created);
      } catch (error) {
        results.errors.push({ topicId: reg.topicId, error: error.message });
      }
    }

    return results;
  }

  async findAll(params: RegistrationQueryDto) {
    const { skip = 0, take = 20, status, topicId, studentId } = params;

    const where: Prisma.RegistrationWhereInput = {};
    if (status) where.status = status;
    if (topicId) where.topicId = topicId;
    if (studentId) where.studentId = studentId;

    const [registrations, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { id: true, mssv: true, name: true, email: true } },
          topic: {
            select: {
              id: true,
              code: true,
              title: true,
              supervisor: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.registration.count({ where }),
    ]);

    return { data: registrations, total, skip, take };
  }

  async findOne(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, mssv: true, name: true, email: true } },
        topic: {
          include: {
            supervisor: { select: { id: true, name: true, email: true } },
            major: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return registration;
  }

  async findByStudent(studentId: string) {
    return this.prisma.registration.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        topic: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            supervisor: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async findByTopic(topicId: string, params?: { status?: RegistrationStatus }) {
    const where: Prisma.RegistrationWhereInput = { topicId };
    if (params?.status) where.status = params.status;

    return this.prisma.registration.findMany({
      where,
      orderBy: { orderChoice: 'asc' },
      include: {
        student: { select: { id: true, mssv: true, name: true, email: true } },
      },
    });
  }

  // ============== TEACHER APPROVAL ==============

  async approve(id: string, teacherId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { topic: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    // Verify teacher is the supervisor
    if (registration.topic.supervisorId !== teacherId) {
      throw new ForbiddenException('Only the assigned supervisor can approve this registration');
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new BadRequestException('Only pending registrations can be approved');
    }

    // Check topic capacity
    const approvedCount = await this.prisma.registration.count({
      where: {
        topicId: registration.topicId,
        status: RegistrationStatus.APPROVED,
      },
    });

    if (approvedCount >= registration.topic.maxStudents) {
      throw new BadRequestException('Topic has reached maximum capacity');
    }

    // If topic doesn't allow multiple orders, reject other pending registrations
    if (!registration.topic.isMultipleOrder) {
      await this.prisma.registration.updateMany({
        where: {
          topicId: registration.topicId,
          id: { not: id },
          status: RegistrationStatus.PENDING,
        },
        data: { status: RegistrationStatus.REJECTED, rejectionReason: 'Another student was approved' },
      });
    }

    return this.prisma.registration.update({
      where: { id },
      data: {
        status: RegistrationStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: teacherId,
      },
      include: {
        student: { select: { id: true, mssv: true, name: true, email: true } },
        topic: {
          select: { id: true, code: true, title: true },
        },
      },
    });
  }

  async reject(id: string, teacherId: string, reason: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { topic: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    if (registration.topic.supervisorId !== teacherId) {
      throw new ForbiddenException('Only the assigned supervisor can reject this registration');
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new BadRequestException('Only pending registrations can be rejected');
    }

    return this.prisma.registration.update({
      where: { id },
      data: {
        status: RegistrationStatus.REJECTED,
        rejectionReason: reason,
      },
    });
  }

  async cancel(id: string, studentId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    if (registration.studentId !== studentId) {
      throw new ForbiddenException('You can only cancel your own registrations');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('Registration is already cancelled');
    }

    return this.prisma.registration.update({
      where: { id },
      data: { status: RegistrationStatus.CANCELLED },
    });
  }

  // ============== SECRETARY OVERRIDE ==============

  async secretaryOverride(id: string, approverId: string, action: 'approve' | 'reject', reason?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { topic: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    const data: any = {};

    if (action === 'approve') {
      data.status = RegistrationStatus.APPROVED;
      data.approvedAt = new Date();
      data.approvedById = approverId;
    } else {
      data.status = RegistrationStatus.REJECTED;
      data.rejectionReason = reason;
    }

    return this.prisma.registration.update({
      where: { id },
      data,
      include: {
        student: { select: { id: true, mssv: true, name: true, email: true } },
        topic: { select: { id: true, code: true, title: true } },
      },
    });
  }

  // ============== STATISTICS ==============

  async getRegistrationStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.registration.count(),
      this.prisma.registration.count({ where: { status: RegistrationStatus.PENDING } }),
      this.prisma.registration.count({ where: { status: RegistrationStatus.APPROVED } }),
      this.prisma.registration.count({ where: { status: RegistrationStatus.REJECTED } }),
    ]);

    return { total, pending, approved, rejected };
  }

  async getStudentRegistrationStats(studentId: string) {
    return this.prisma.registration.groupBy({
      by: ['status'],
      where: { studentId },
      _count: true,
    });
  }
}
