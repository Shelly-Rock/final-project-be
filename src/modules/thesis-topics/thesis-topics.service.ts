import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateThesisTopicDto,
  UpdateThesisTopicDto,
  ThesisTopicQueryDto,
} from './dto/thesis-topic.dto';
import { Prisma, TopicStatus } from '@prisma/client';

@Injectable()
export class ThesisTopicsService {
  constructor(private prisma: PrismaService) {}

  private async generateTopicCode(): Promise<string> {
    const lastTopic = await this.prisma.thesisTopic.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (lastTopic?.code) {
      const match = lastTopic.code.match(/DT-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `DT-${nextNumber.toString().padStart(4, '0')}`;
  }

  async create(data: CreateThesisTopicDto, userId: string) {
    // Verify supervisor exists and is a TEACHER
    const supervisor = await this.prisma.user.findUnique({
      where: { id: data.supervisorId },
    });

    if (!supervisor) {
      throw new NotFoundException(`Teacher with ID ${data.supervisorId} not found`);
    }

    if (supervisor.role !== 'TEACHER') {
      throw new BadRequestException('Assigned user must be a TEACHER');
    }

    // Check supervisor's current topic count
    const currentTopics = await this.prisma.thesisTopic.count({
      where: {
        supervisorId: data.supervisorId,
        status: { in: [TopicStatus.PENDING_APPROVAL, TopicStatus.APPROVED] },
      },
    });

    if (currentTopics >= 10) {
      throw new BadRequestException(`Teacher has reached maximum topic limit (10)`);
    }

    const code = await this.generateTopicCode();

    return this.prisma.thesisTopic.create({
      data: {
        ...data,
        code,
        createdById: userId,
      },
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
        _count: { select: { registrations: true } },
      },
    });
  }

  async findAll(params: ThesisTopicQueryDto) {
    const {
      skip = 0,
      take = 20,
      search,
      status,
      supervisorId,
      majorId,
    } = params;

    const where: Prisma.ThesisTopicWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (supervisorId) where.supervisorId = supervisorId;
    if (majorId) where.majorId = majorId;

    const [topics, total] = await Promise.all([
      this.prisma.thesisTopic.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          supervisor: { select: { id: true, email: true, name: true } },
          major: { select: { id: true, code: true, name: true } },
          _count: {
            select: {
              registrations: {
                where: { status: { in: ['APPROVED', 'PENDING'] } },
              },
            },
          },
        },
      }),
      this.prisma.thesisTopic.count({ where }),
    ]);

    return {
      data: topics.map((topic) => ({
        ...topic,
        registeredCount: topic._count.registrations,
      })),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const topic = await this.prisma.thesisTopic.findUnique({
      where: { id },
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: true,
        createdBy: { select: { id: true, name: true, email: true } },
        registrations: {
          include: {
            student: { select: { id: true, mssv: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { registrations: true } },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    return topic;
  }

  async findByCode(code: string) {
    const topic = await this.prisma.thesisTopic.findUnique({
      where: { code },
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: true,
        registrations: { include: { student: true } },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with code "${code}" not found`);
    }

    return topic;
  }

  async update(id: string, data: UpdateThesisTopicDto, userId: string, userRole: string) {
    const topic = await this.prisma.thesisTopic.findUnique({ where: { id } });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    // Only supervisor, creator, secretary, or admin can update
    if (
      userRole !== 'ADMIN' &&
      userRole !== 'SECRETARY' &&
      topic.supervisorId !== userId &&
      topic.createdById !== userId
    ) {
      throw new ForbiddenException('You do not have permission to update this topic');
    }

    return this.prisma.thesisTopic.update({
      where: { id },
      data,
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
        _count: { select: { registrations: true } },
      },
    });
  }

  async delete(id: string) {
    const topic = await this.prisma.thesisTopic.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    if (topic._count.registrations > 0) {
      throw new ConflictException('Cannot delete topic with existing registrations');
    }

    await this.prisma.thesisTopic.delete({ where: { id } });
    return { message: 'Topic deleted successfully' };
  }

  // ============== APPROVAL FLOW ==============

  async approve(id: string, approverId: string) {
    const topic = await this.prisma.thesisTopic.findUnique({ where: { id } });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    if (topic.status !== TopicStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending topics can be approved');
    }

    return this.prisma.thesisTopic.update({
      where: { id },
      data: {
        status: TopicStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: approverId,
      },
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async reject(id: string, approverId: string, reason: string) {
    const topic = await this.prisma.thesisTopic.findUnique({ where: { id } });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    if (topic.status !== TopicStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending topics can be rejected');
    }

    return this.prisma.thesisTopic.update({
      where: { id },
      data: {
        status: TopicStatus.REJECTED,
        rejectionReason: reason,
      },
    });
  }

  async close(id: string) {
    const topic = await this.prisma.thesisTopic.findUnique({ where: { id } });

    if (!topic) {
      throw new NotFoundException(`Thesis topic with ID ${id} not found`);
    }

    if (topic.status !== TopicStatus.APPROVED) {
      throw new BadRequestException('Only approved topics can be closed');
    }

    return this.prisma.thesisTopic.update({
      where: { id },
      data: { status: TopicStatus.CLOSED },
    });
  }

  // ============== TEACHER TOPIC MANAGEMENT ==============

  async findBySupervisor(supervisorId: string, params?: { status?: TopicStatus }) {
    const where: Prisma.ThesisTopicWhereInput = { supervisorId };
    if (params?.status) {
      where.status = params.status;
    }

    return this.prisma.thesisTopic.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        major: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            registrations: {
              where: { status: { in: ['APPROVED', 'PENDING'] } },
            },
          },
        },
      },
    });
  }

  async getTeacherTopicCount(supervisorId: string): Promise<number> {
    return this.prisma.thesisTopic.count({
      where: {
        supervisorId,
        status: { in: [TopicStatus.PENDING_APPROVAL, TopicStatus.APPROVED] },
      },
    });
  }

  // ============== SECRETARY FUNCTIONS ==============

  async getPendingApproval() {
    return this.prisma.thesisTopic.findMany({
      where: { status: TopicStatus.PENDING_APPROVAL },
      orderBy: { createdAt: 'asc' },
      include: {
        supervisor: { select: { id: true, email: true, name: true } },
        major: { select: { id: true, code: true, name: true } },
        _count: { select: { registrations: true } },
      },
    });
  }

  async bulkAssignSupervisors(assignments: Array<{ topicId: string; supervisorId: string }>) {
    const results = { success: [] as string[], errors: [] as string[] };

    for (const { topicId, supervisorId } of assignments) {
      try {
        const topic = await this.prisma.thesisTopic.findUnique({ where: { id: topicId } });
        if (!topic) {
          results.errors.push(`${topicId}: Topic not found`);
          continue;
        }

        const teacher = await this.prisma.user.findUnique({ where: { id: supervisorId } });
        if (!teacher || teacher.role !== 'TEACHER') {
          results.errors.push(`${topicId}: Invalid teacher`);
          continue;
        }

        await this.prisma.thesisTopic.update({
          where: { id: topicId },
          data: { supervisorId },
        });
        results.success.push(topicId);
      } catch (error) {
        results.errors.push(`${topicId}: ${error.message}`);
      }
    }

    return results;
  }

  // ============== DEADLINE MANAGEMENT ==============

  async getUpcomingDeadlines(warningDays: number = 3) {
    const now = new Date();
    const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

    return this.prisma.thesisTopic.findMany({
      where: {
        status: TopicStatus.APPROVED,
        deadline: {
          gte: now,
          lte: warningDate,
        },
      },
      include: {
        supervisor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async closeExpiredTopics() {
    const now = new Date();
    const expiredTopics = await this.prisma.thesisTopic.findMany({
      where: {
        status: TopicStatus.APPROVED,
        deadline: { lt: now },
      },
    });

    if (expiredTopics.length > 0) {
      await this.prisma.thesisTopic.updateMany({
        where: {
          id: { in: expiredTopics.map((t) => t.id) },
        },
        data: { status: TopicStatus.CLOSED },
      });
    }

    return {
      closedCount: expiredTopics.length,
      topics: expiredTopics.map((t) => ({ id: t.id, code: t.code, title: t.title })),
    };
  }
}
