import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  CreateCommitteeDto,
  UpdateCommitteeDto,
  CommitteeQueryDto,
  CommitteeRoleLabel,
} from './committee.dto';
import { CommitteeRole } from '@prisma/client';

@Injectable()
export class CommitteeService {
  constructor(private prisma: PrismaService) {}

  // Validation: Teacher cannot be in committee that reviews their own projects
  private async validateTeacherNotOwnProject(
    teacherId: number,
    committeeId?: number,
  ) {
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

    const committees = await this.prisma.defense_committees.findMany({
      where: whereClause,
      include: {
        committee_members: {
          include: {
            teachers: {
              select: { name: true },
            },
          },
        },
      },
    });

    for (const committee of committees) {
      const isMember = committee.committee_members.some(
        (m) => m.teacher_id === teacherId,
      );
      if (isMember) {
        const member = committee.committee_members.find(
          (m) => m.teacher_id === teacherId,
        );
        conflicts.push(
          `Đã là thành viên của "${committee.name}" (${member?.teachers.name})`,
        );
      }
    }

    return conflicts;
  }

  // Get all available teachers for committee assignment
  async getAvailableTeachers(facultyId?: string) {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        deleted_at: null,
        ...(facultyId ? { faculty_id: facultyId } : {}),
      },
      select: {
        id: true,
        teacher_id: true,
        name: true,
        email: true,
        faculty: { select: { name: true } },
      },
    });

    return teachers.map((t) => ({
      id: t.id,
      teacher_id: t.teacher_id,
      name: t.name,
      email: t.email,
      faculty: t.faculty?.name || null,
    }));
  }

  async getTeacherConflicts(teacherId: number, excludeCommitteeId?: number) {
    return this.checkTeacherConflicts(teacherId, excludeCommitteeId);
  }

  // Get all external reviewers (teachers who can be in multiple committees)
  async getExternalReviewers(facultyId?: string) {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        deleted_at: null,
        ...(facultyId ? { faculty_id: facultyId } : {}),
      },
      select: {
        id: true,
        teacher_id: true,
        name: true,
        email: true,
        faculty: { select: { name: true } },
      },
    });

    return teachers.map((t) => ({
      id: t.id,
      teacher_id: t.teacher_id,
      name: t.name,
      email: t.email,
      faculty: t.faculty?.name || null,
    }));
  }

  async createCommittee(dto: CreateCommitteeDto) {
    this.assertCommitteeComposition(dto);
    await this.assertFixedMembersAvailable(
      [dto.chairman_id, dto.secretary_id, dto.internal_1_id],
    );
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
    const committee = await this.prisma.defense_committees.create({
      data: {
        name: dto.name,
        period_id: dto.period_id,
        updated_at: new Date(),
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
      await this.prisma.committee_members.createMany({
        data: membersToAdd,
      });
    }

    // Add external reviewers
    if (dto.external_reviewer_ids && dto.external_reviewer_ids.length > 0) {
      await this.prisma.committee_external_reviewers.createMany({
        data: dto.external_reviewer_ids.map((teacherId) => ({
          committee_id: committee.id,
          teacher_id: teacherId,
        })),
      });
    }

    return this.getCommitteeById(committee.id);
  }

  async getCommittees(query: CommitteeQueryDto) {
    const { page = 1, limit = 20, name, faculty_id, period_id } = query;

    const where: any = { deleted_at: null };
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (period_id) {
      where.period_id = period_id;
    }
    if (faculty_id) {
      where.committee_members = {
        some: { teachers: { faculty_id } },
      };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.defense_committees.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.defense_committees.count({ where }),
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
    const committee = await this.prisma.defense_committees.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    return this.enrichCommittee(committee.id);
  }

  private async enrichCommittee(committeeId: number) {
    const committee = await this.prisma.defense_committees.findUnique({
      where: { id: committeeId },
      include: {
        committee_members: {
          include: {
            teachers: {
              select: { id: true, teacher_id: true, name: true, email: true },
            },
          },
        },
        committee_external_reviewers: {
          include: {
            teachers: {
              select: { id: true, teacher_id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!committee) return null;

    // Extract members by role
    const chairman = committee.committee_members.find(
      (m) => m.role === CommitteeRole.CHAIRMAN,
    );
    const secretary = committee.committee_members.find(
      (m) => m.role === CommitteeRole.SECRETARY,
    );
    const internalReviewers = committee.committee_members.filter(
      (m) => m.role === CommitteeRole.INTERNAL_REVIEWER,
    );

    return {
      id: committee.id,
      name: committee.name,
      period_id: committee.period_id,
      chairman_id: chairman?.teacher_id || null,
      chairman_name: chairman?.teachers.name || null,
      secretary_id: secretary?.teacher_id || null,
      secretary_name: secretary?.teachers.name || null,
      internal_1_id: internalReviewers[0]?.teacher_id || null,
      internal_1_name: internalReviewers[0]?.teachers.name || null,
      internal_2_id: internalReviewers[1]?.teacher_id || null,
      internal_2_name: internalReviewers[1]?.teachers.name || null,
      members: committee.committee_members.map((m) => ({
        id: m.teachers.id,
        teacher_id: m.teachers.teacher_id,
        name: m.teachers.name,
        email: m.teachers.email,
        role: m.role,
      })),
      external_reviewers: committee.committee_external_reviewers.map((er) => ({
        id: er.teachers.id,
        teacher_id: er.teachers.teacher_id,
        name: er.teachers.name,
        email: er.teachers.email,
      })),
      member_count:
        committee.committee_members.length +
        committee.committee_external_reviewers.length,
      created_at: committee.created_at,
      updated_at: committee.updated_at,
    };
  }

  private countMembers(membersCount: number, externalCount: number): number {
    return membersCount + externalCount;
  }

  async updateCommittee(id: number, dto: UpdateCommitteeDto) {
    const committee = await this.prisma.defense_committees.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    if (
      dto.chairman_id !== undefined ||
      dto.secretary_id !== undefined ||
      dto.internal_1_id !== undefined ||
      dto.internal_2_id !== undefined ||
      dto.external_reviewer_ids !== undefined
    ) {
      const currentMembership = await this.prisma.committee_members.findMany({
        where: { committee_id: id },
      });
      const currentExternal = await this.prisma.committee_external_reviewers.findMany({
        where: { committee_id: id },
        select: { teacher_id: true },
      });
      const composition = {
        chairman_id:
          dto.chairman_id ?? currentMembership.find((m) => m.role === CommitteeRole.CHAIRMAN)?.teacher_id,
        secretary_id:
          dto.secretary_id ?? currentMembership.find((m) => m.role === CommitteeRole.SECRETARY)?.teacher_id,
        internal_1_id:
          dto.internal_1_id ?? currentMembership.find((m) => m.role === CommitteeRole.INTERNAL_REVIEWER)?.teacher_id,
        internal_2_id: dto.internal_2_id,
        external_reviewer_ids: dto.external_reviewer_ids ?? currentExternal.map((item) => item.teacher_id),
      };
      this.assertCommitteeComposition(composition);
      await this.assertFixedMembersAvailable(
        [composition.chairman_id, composition.secretary_id, composition.internal_1_id],
        id,
      );
    }

    // Get current members
    const currentMembers = await this.prisma.committee_members.findMany({
      where: { committee_id: id },
    });

    // Validate conflicts for new members
    if (dto.chairman_id) {
      const existingChairman = currentMembers.find(
        (m) => m.role === CommitteeRole.CHAIRMAN,
      );
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

    await this.prisma.defense_committees.update({
      where: { id },
      data: updateData,
    });

    // Update members if provided
    if (
      dto.chairman_id !== undefined ||
      dto.secretary_id !== undefined ||
      dto.internal_1_id !== undefined ||
      dto.internal_2_id !== undefined
    ) {
      // Delete existing internal members
      await this.prisma.committee_members.deleteMany({
        where: {
          committee_id: id,
          role: {
            in: [
              CommitteeRole.CHAIRMAN,
              CommitteeRole.SECRETARY,
              CommitteeRole.INTERNAL_REVIEWER,
            ],
          },
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
        await this.prisma.committee_members.createMany({
          data: membersToAdd,
          skipDuplicates: true,
        });
      }
    }

    // Update external reviewers if provided
    if (dto.external_reviewer_ids !== undefined) {
      // Remove existing
      await this.prisma.committee_external_reviewers.deleteMany({
        where: { committee_id: id },
      });

      // Add new
      if (dto.external_reviewer_ids.length > 0) {
        await this.prisma.committee_external_reviewers.createMany({
          data: dto.external_reviewer_ids.map((teacherId) => ({
            committee_id: id,
            teacher_id: teacherId,
          })),
        });
      }
    }

    return this.getCommitteeById(id);
  }

  private assertCommitteeComposition(dto: {
    chairman_id?: number;
    secretary_id?: number;
    internal_1_id?: number;
    internal_2_id?: number;
    external_reviewer_ids?: number[];
  }) {
    const fixedIds = [dto.chairman_id, dto.secretary_id, dto.internal_1_id];
    const externalIds = dto.external_reviewer_ids ?? [];
    if (fixedIds.some((id) => !id) || externalIds.length !== 1) {
      throw new BadRequestException(
        'Hội đồng phải có Chủ tịch, Thư ký, một Phản biện trong và một Phản biện ngoài.',
      );
    }
    if (dto.internal_2_id) {
      throw new BadRequestException('Hội đồng chỉ được có một Phản biện trong.');
    }
    const assignedIds = [...fixedIds, externalIds[0]];
    if (new Set(assignedIds).size !== assignedIds.length) {
      throw new BadRequestException('Một giảng viên không thể giữ nhiều vai trò trong cùng hội đồng.');
    }
  }

  private async assertFixedMembersAvailable(
    teacherIds: Array<number | undefined>,
    excludeCommitteeId?: number,
  ) {
    for (const teacherId of teacherIds) {
      if (!teacherId) continue;
      const conflicts = await this.checkTeacherConflicts(
        teacherId,
        excludeCommitteeId,
      );
      if (conflicts.length > 0) {
        throw new ConflictException(
          `Giảng viên ${teacherId} đã là thành viên của hội đồng khác: ${conflicts.join(', ')}`,
        );
      }
    }
  }

  async deleteCommittee(id: number) {
    const committee = await this.prisma.defense_committees.findFirst({
      where: { id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    // Check if has defense sessions
    const sessions = await this.prisma.defense_sessions.findMany({
      where: { committee_id: id, deleted_at: null },
    });

    if (sessions.length > 0) {
      throw new BadRequestException(
        'Không thể xóa hội đồng đã có lịch bảo vệ. Vui lòng xóa lịch trước.',
      );
    }

    // Soft delete (cascade will delete members)
    return this.prisma.defense_committees.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async getStats(facultyId?: string, periodId?: number) {
    const committees = await this.prisma.defense_committees.findMany({
      where: {
        deleted_at: null,
        ...(facultyId
          ? { committee_members: { some: { teachers: { faculty_id: facultyId } } } }
          : {}),
      },
      include: {
        committee_members: true,
        committee_external_reviewers: true,
      },
    });

    let fullMembers = 0;
    let missingMembers = 0;

    for (const c of committees) {
      const memberCount = this.countMembers(
        c.committee_members.length,
        c.committee_external_reviewers.length,
      );
      if (memberCount >= 4) {
        fullMembers++;
      } else {
        missingMembers++;
      }
    }

    const externalReviewers =
      await this.prisma.committee_external_reviewers.findMany({
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

    const committees = await this.prisma.defense_committees.findMany({
      where: whereClause,
      include: {
        committee_members: {
          where: {
            role: {
              in: [
                CommitteeRole.CHAIRMAN,
                CommitteeRole.SECRETARY,
                CommitteeRole.INTERNAL_REVIEWER,
              ],
            },
          },
        },
      },
    });

    for (const c of committees) {
      // Only exclude internal members of other committees (not external reviewers)
      for (const member of c.committee_members) {
        excludedIds.push(member.teacher_id);
      }
    }

    // Nếu đang sửa 1 Hội đồng, cũng loại trừ các GVHD của các đề tài đang được chấm trong HĐ đó
    if (committeeId) {
      const sessions = await this.prisma.defense_sessions.findMany({
        where: { committee_id: committeeId, deleted_at: null },
        include: {
          defense_session_projects: {
            include: {
              projects: true,
            },
          },
        },
      });

      for (const session of sessions) {
        for (const sp of session.defense_session_projects) {
          if (sp.projects?.teacher_id) {
            excludedIds.push(sp.projects.teacher_id);
          }
        }
      }
    }

    return [...new Set(excludedIds)];
  }
}
