import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateCommitteeDto, UpdateCommitteeDto, CommitteeQueryDto, CommitteeRoleLabel } from './committee.dto';

@Injectable()
export class CommitteeService {
  constructor(private prisma: PrismaService) {}

  // Validation: Teacher cannot be in committee that reviews their own projects
  private async validateTeacherNotOwnProject(teacherId: number, committeeId?: number) {
    // Get teacher's supervised projects
    const teacherProjects = await this.prisma.project.findMany({
      where: { teacher_id: teacherId },
      select: { id: true, project_id: true },
    });

    if (teacherProjects.length === 0) return; // Teacher has no projects, no conflict

    const projectIds = teacherProjects.map((p) => p.id);

    // Check if any of these projects are in committees being set up
    // This would need more complex logic with defense sessions
    // For now, we just check at committee creation/update time
  }

  // Check if a teacher is already a member of another committee
  private async checkTeacherConflicts(
    teacherId: number,
    excludeCommitteeId?: number,
  ): Promise<string[]> {
    const conflicts: string[] = [];

    const committees = await this.prisma.defenseCommittee.findMany({
      where: excludeCommitteeId ? { id: { not: excludeCommitteeId }, deleted_at: null } : { deleted_at: null },
    });

    for (const committee of committees) {
      const isMember =
        committee.chairman_id === teacherId ||
        committee.secretary_id === teacherId ||
        committee.internal_1_id === teacherId ||
        committee.internal_2_id === teacherId;

      if (isMember) {
        conflicts.push(`Đã là thành viên của "${committee.name}" (vai trò cố định)`);
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
        chairman_id: dto.chairman_id,
        secretary_id: dto.secretary_id,
        internal_1_id: dto.internal_1_id,
        internal_2_id: dto.internal_2_id,
      },
    });

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
      data.map((c) => this.enrichCommittee(c)),
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

    return this.enrichCommittee(committee);
  }

  private async enrichCommittee(committee: any) {
    const [
      chairman,
      secretary,
      internal_1,
      internal_2,
      externalReviewers,
    ] = await Promise.all([
      committee.chairman_id
        ? this.prisma.teacher.findUnique({
            where: { id: committee.chairman_id },
            select: { name: true, teacher_id: true },
          })
        : null,
      committee.secretary_id
        ? this.prisma.teacher.findUnique({
            where: { id: committee.secretary_id },
            select: { name: true, teacher_id: true },
          })
        : null,
      committee.internal_1_id
        ? this.prisma.teacher.findUnique({
            where: { id: committee.internal_1_id },
            select: { name: true, teacher_id: true },
          })
        : null,
      committee.internal_2_id
        ? this.prisma.teacher.findUnique({
            where: { id: committee.internal_2_id },
            select: { name: true, teacher_id: true },
          })
        : null,
      this.prisma.committeeExternalReviewer.findMany({
        where: { committee_id: committee.id },
        include: {
          teacher: {
            select: { id: true, teacher_id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      id: committee.id,
      name: committee.name,
      chairman_id: committee.chairman_id,
      chairman_name: chairman?.name || null,
      secretary_id: committee.secretary_id,
      secretary_name: secretary?.name || null,
      internal_1_id: committee.internal_1_id,
      internal_1_name: internal_1?.name || null,
      internal_2_id: committee.internal_2_id,
      internal_2_name: internal_2?.name || null,
      external_reviewers: externalReviewers.map((er) => ({
        id: er.teacher.id,
        teacher_id: er.teacher.teacher_id,
        name: er.teacher.name,
        email: er.teacher.email,
      })),
      member_count: this.countMembers(committee, externalReviewers.length),
      created_at: committee.created_at,
      updated_at: committee.updated_at,
    };
  }

  private countMembers(committee: any, externalCount: number): number {
    let count = 0;
    if (committee.chairman_id) count++;
    if (committee.secretary_id) count++;
    if (committee.internal_1_id) count++;
    if (committee.internal_2_id) count++;
    return count + externalCount;
  }

  async updateCommittee(id: number, dto: UpdateCommitteeDto) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    // Validate conflicts for new members
    if (dto.chairman_id && dto.chairman_id !== committee.chairman_id) {
      const conflicts = await this.checkTeacherConflicts(dto.chairman_id, id);
      if (conflicts.length > 0) {
        throw new ConflictException(
          `GV ${dto.chairman_id} đã là thành viên của hội đồng khác: ${conflicts.join(', ')}`,
        );
      }
    }

    // Update committee
    const updated = await this.prisma.defenseCommittee.update({
      where: { id },
      data: {
        name: dto.name,
        chairman_id: dto.chairman_id,
        secretary_id: dto.secretary_id,
        internal_1_id: dto.internal_1_id,
        internal_2_id: dto.internal_2_id,
      },
    });

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

    // Soft delete
    return this.prisma.defenseCommittee.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async getStats() {
    const committees = await this.prisma.defenseCommittee.findMany({
      where: { deleted_at: null },
      include: {
        external_reviewers: true,
      },
    });

    let fullMembers = 0;
    let missingMembers = 0;

    for (const c of committees) {
      const memberCount = this.countMembers(c, c.external_reviewers.length);
      if (memberCount >= 4) {
        fullMembers++;
      } else {
        missingMembers++;
      }
    }

    // Count unique external reviewers
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

    const committees = await this.prisma.defenseCommittee.findMany({
      where: committeeId ? { id: { not: committeeId }, deleted_at: null } : { deleted_at: null },
      include: {
        external_reviewers: true,
      },
    });

    for (const c of committees) {
      // Only exclude internal members (not external reviewers)
      if (c.chairman_id) excludedIds.push(c.chairman_id);
      if (c.secretary_id) excludedIds.push(c.secretary_id);
      if (c.internal_1_id) excludedIds.push(c.internal_1_id);
      if (c.internal_2_id) excludedIds.push(c.internal_2_id);
      // External reviewers CAN be in multiple committees, so don't exclude
    }

    return [...new Set(excludedIds)];
  }
}
