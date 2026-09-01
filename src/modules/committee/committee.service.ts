import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateCommitteeDto, UpdateCommitteeDto, CommitteeQueryDto, CommitteeRoleLabel } from './committee.dto';
import { CommitteeRole } from '@prisma/client';

@Injectable()
export class CommitteeService {
  constructor(private prisma: PrismaService) {}

  // Validation: Teacher cannot be in committee that reviews their own projects
  private async validateTeacherNotOwnProject(teacherId: number, committeeId?: number) {
    const teacherProjects = await this.prisma.project.findMany({
      where: { teacher_id: teacherId },
      select: { id: true, project_id: true },
    });

    if (teacherProjects.length === 0) return;
    // More complex logic would check defense sessions
  }

  // Check if a teacher is already a member of another committee
  private async checkTeacherConflicts(
    teacherId: number,
    excludeCommitteeId?: number,
  ): Promise<string[]> {
    const conflicts: string[] = [];

    const whereClause = excludeCommitteeId
      ? { id: { not: excludeCommitteeId }, deleted_at: null }
      : { deleted_at: null };

    const committees = await this.prisma.defenseCommittee.findMany({
      where: whereClause,
      include: {
        members: {
          include: {
            teacher: {
              select: { name: true },
            },
          },
        },
      },
    });

    for (const committee of committees) {
      const isMember = committee.members.some((m) => m.teacher_id === teacherId);
      if (isMember) {
        const member = committee.members.find((m) => m.teacher_id === teacherId);
        conflicts.push(`Đã là thành viên của "${committee.name}" (${member?.teacher.name})`);
      }
    }

    return conflicts;
  }

  // Get all available teachers for committee assignment
  async getAvailableTeachers() {
    const teachers = await this.prisma.teacher.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        teacher_id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
        faculty: { select: { name: true } },
      },
    });

    return teachers.map((t) => ({
      id: t.id,
      teacher_id: t.teacher_id,
      name: t.name,
      email: t.email,
      department: t.department?.name || null,
      faculty: t.faculty?.name || null,
    }));
  }

  // Get all external reviewers (teachers who can be in multiple committees)
  async getExternalReviewers() {
    const teachers = await this.prisma.teacher.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        teacher_id: true,
        name: true,
        email: true,
        department: { select: { name: true } },
        faculty: { select: { name: true } },
      },
    });

    return teachers.map((t) => ({
      id: t.id,
      teacher_id: t.teacher_id,
      name: t.name,
      email: t.email,
      department: t.department?.name || null,
    }));
  }

  async createCommittee(dto: CreateCommitteeDto) {
    // Validate members if provided
    if (dto.chairman_id) {
      const conflicts = await this.checkTeacherConflicts(dto.chairman_id);
      if (conflicts.length > 0) {
        throw new ConflictException(
          `GV ${dto.chairman_id} đã là thành viên của hội đồng khác: ${conflicts.join(', ')}`,
        );
      }
    }

    // Create committee
    const committee = await this.prisma.defenseCommittee.create({
      data: {
        name: dto.name,
        period_id: dto.period_id,
      },
    });

    // Add internal members (Chairman, Secretary, Internal Reviewers)
    const membersToAdd = [];

    if (dto.chairman_id) {
      membersToAdd.push({
        committee_id: committee.id,
        teacher_id: dto.chairman_id,
        role: CommitteeRole.CHAIRMAN,
      });
    }

    if (dto.secretary_id) {
      membersToAdd.push({
        committee_id: committee.id,
        teacher_id: dto.secretary_id,
        role: CommitteeRole.SECRETARY,
      });
    }

    if (dto.internal_1_id) {
      membersToAdd.push({
        committee_id: committee.id,
        teacher_id: dto.internal_1_id,
        role: CommitteeRole.INTERNAL_REVIEWER,
      });
    }

    if (dto.internal_2_id) {
      membersToAdd.push({
        committee_id: committee.id,
        teacher_id: dto.internal_2_id,
        role: CommitteeRole.INTERNAL_REVIEWER,
      });
    }

    if (membersToAdd.length > 0) {
      await this.prisma.committeeMember.createMany({
        data: membersToAdd,
      });
    }

    // Add external reviewers
    if (dto.external_reviewer_ids && dto.external_reviewer_ids.length > 0) {
      await this.prisma.committeeExternalReviewer.createMany({
        data: dto.external_reviewer_ids.map((teacherId) => ({
          committee_id: committee.id,
          teacher_id: teacherId,
        })),
      });
    }

    return this.getCommitteeById(committee.id);
  }

  async getCommittees(query: CommitteeQueryDto) {
    const { page = 1, limit = 20, name } = query;

    const where: any = { deleted_at: null };
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.defenseCommittee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.defenseCommittee.count({ where }),
    ]);

    const enrichedData = await Promise.all(
      data.map((c) => this.enrichCommittee(c.id)),
    );

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCommitteeById(id: number) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    return this.enrichCommittee(committee.id);
  }

  private async enrichCommittee(committeeId: number) {
    const committee = await this.prisma.defenseCommittee.findUnique({
      where: { id: committeeId },
      include: {
        members: {
          include: {
            teacher: {
              select: { id: true, teacher_id: true, name: true, email: true },
            },
          },
        },
        external_reviewers: {
          include: {
            teacher: {
              select: { id: true, teacher_id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!committee) return null;

    // Extract members by role
    const chairman = committee.members.find((m) => m.role === CommitteeRole.CHAIRMAN);
    const secretary = committee.members.find((m) => m.role === CommitteeRole.SECRETARY);
    const internalReviewers = committee.members.filter((m) => m.role === CommitteeRole.INTERNAL_REVIEWER);

    return {
      id: committee.id,
      name: committee.name,
      period_id: committee.period_id,
      chairman_id: chairman?.teacher_id || null,
      chairman_name: chairman?.teacher.name || null,
      secretary_id: secretary?.teacher_id || null,
      secretary_name: secretary?.teacher.name || null,
      internal_1_id: internalReviewers[0]?.teacher_id || null,
      internal_1_name: internalReviewers[0]?.teacher.name || null,
      internal_2_id: internalReviewers[1]?.teacher_id || null,
      internal_2_name: internalReviewers[1]?.teacher.name || null,
      members: committee.members.map((m) => ({
        id: m.teacher.id,
        teacher_id: m.teacher.teacher_id,
        name: m.teacher.name,
        email: m.teacher.email,
        role: m.role,
      })),
      external_reviewers: committee.external_reviewers.map((er) => ({
        id: er.teacher.id,
        teacher_id: er.teacher.teacher_id,
        name: er.teacher.name,
        email: er.teacher.email,
      })),
      member_count: committee.members.length + committee.external_reviewers.length,
      created_at: committee.created_at,
      updated_at: committee.updated_at,
    };
  }

  private countMembers(membersCount: number, externalCount: number): number {
    return membersCount + externalCount;
  }

  async updateCommittee(id: number, dto: UpdateCommitteeDto) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    // Get current members
    const currentMembers = await this.prisma.committeeMember.findMany({
      where: { committee_id: id },
    });

    // Validate conflicts for new members
    if (dto.chairman_id) {
      const existingChairman = currentMembers.find((m) => m.role === CommitteeRole.CHAIRMAN);
      if (existingChairman && existingChairman.teacher_id !== dto.chairman_id) {
        const conflicts = await this.checkTeacherConflicts(dto.chairman_id, id);
        if (conflicts.length > 0) {
          throw new ConflictException(
            `GV ${dto.chairman_id} đã là thành viên của hội đồng khác: ${conflicts.join(', ')}`,
          );
        }
      }
    }

    // Update committee
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.period_id !== undefined) updateData.period_id = dto.period_id;

    await this.prisma.defenseCommittee.update({
      where: { id },
      data: updateData,
    });

    // Update members if provided
    if (dto.chairman_id !== undefined || dto.secretary_id !== undefined || 
        dto.internal_1_id !== undefined || dto.internal_2_id !== undefined) {
      
      // Delete existing internal members
      await this.prisma.committeeMember.deleteMany({
        where: {
          committee_id: id,
          role: { in: [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] },
        },
      });

      // Add new internal members
      const membersToAdd = [];

      if (dto.chairman_id) {
        membersToAdd.push({
          committee_id: id,
          teacher_id: dto.chairman_id,
          role: CommitteeRole.CHAIRMAN,
        });
      }

      if (dto.secretary_id) {
        membersToAdd.push({
          committee_id: id,
          teacher_id: dto.secretary_id,
          role: CommitteeRole.SECRETARY,
        });
      }

      if (dto.internal_1_id) {
        membersToAdd.push({
          committee_id: id,
          teacher_id: dto.internal_1_id,
          role: CommitteeRole.INTERNAL_REVIEWER,
        });
      }

      if (dto.internal_2_id) {
        membersToAdd.push({
          committee_id: id,
          teacher_id: dto.internal_2_id,
          role: CommitteeRole.INTERNAL_REVIEWER,
        });
      }

      if (membersToAdd.length > 0) {
        await this.prisma.committeeMember.createMany({
          data: membersToAdd,
          skipDuplicates: true,
        });
      }
    }

    // Update external reviewers if provided
    if (dto.external_reviewer_ids !== undefined) {
      // Remove existing
      await this.prisma.committeeExternalReviewer.deleteMany({
        where: { committee_id: id },
      });

      // Add new
      if (dto.external_reviewer_ids.length > 0) {
        await this.prisma.committeeExternalReviewer.createMany({
          data: dto.external_reviewer_ids.map((teacherId) => ({
            committee_id: id,
            teacher_id: teacherId,
          })),
        });
      }
    }

    return this.getCommitteeById(id);
  }

  async deleteCommittee(id: number) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    // Check if has defense sessions
    const sessions = await this.prisma.defenseSession.findMany({
      where: { committee_id: id, deleted_at: null },
    });

    if (sessions.length > 0) {
      throw new BadRequestException(
        'Không thể xóa hội đồng đã có lịch bảo vệ. Vui lòng xóa lịch trước.',
      );
    }

    // Soft delete (cascade will delete members)
    return this.prisma.defenseCommittee.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async getStats() {
    const committees = await this.prisma.defenseCommittee.findMany({
      where: { deleted_at: null },
      include: {
        members: true,
        external_reviewers: true,
      },
    });

    let fullMembers = 0;
    let missingMembers = 0;

    for (const c of committees) {
      const memberCount = this.countMembers(c.members.length, c.external_reviewers.length);
      if (memberCount >= 4) {
        fullMembers++;
      } else {
        missingMembers++;
      }
    }

    const externalReviewers = await this.prisma.committeeExternalReviewer.findMany({
      distinct: ['teacher_id'],
    });

    return {
      total_committees: committees.length,
      committees_with_full_members: fullMembers,
      committees_missing_members: missingMembers,
      total_external_reviewers: externalReviewers.length,
    };
  }

  // Get teachers that should be excluded from a committee
  async getExcludedTeachers(committeeId?: number) {
    const excludedIds: number[] = [];

    const whereClause = committeeId
      ? { id: { not: committeeId }, deleted_at: null }
      : { deleted_at: null };

    const committees = await this.prisma.defenseCommittee.findMany({
      where: whereClause,
      include: {
        members: {
          where: {
            role: { in: [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] },
          },
        },
        external_reviewers: true,
      },
    });

    for (const c of committees) {
      // Only exclude internal members (not external reviewers)
      for (const member of c.members) {
        excludedIds.push(member.teacher_id);
      }
      // External reviewers CAN be in multiple committees, so don't exclude
    }

    return [...new Set(excludedIds)];
  }
}
