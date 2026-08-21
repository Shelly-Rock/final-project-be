import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  DefenseSessionStatus,
  CreateDefenseSessionDto,
  UpdateDefenseSessionDto,
  AddProjectsToSessionDto,
  ScoreProjectDto,
  DefenseSessionQueryDto,
} from './defense.dto';

@Injectable()
export class DefenseService {
  constructor(private prisma: PrismaService) {}

  // Calculate end time based on start time and number of projects
  private calculateEndTime(startTime: string, projectCount: number, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + projectCount * durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  // Calculate scheduled time for each project
  private calculateProjectTimes(startTime: string, projectCount: number, durationMinutes: number): string[] {
    const times: string[] = [];
    const [hours, minutes] = startTime.split(':').map(Number);
    
    for (let i = 0; i < projectCount; i++) {
      const totalMinutes = hours * 60 + minutes + i * durationMinutes;
      const projHours = Math.floor(totalMinutes / 60);
      const projMinutes = totalMinutes % 60;
      times.push(`${projHours.toString().padStart(2, '0')}:${projMinutes.toString().padStart(2, '0')}`);
    }
    
    return times;
  }

  // Validate that no teacher in committee is supervising assigned projects
  private async validateProjectAssignments(committeeId: number, projectIds: number[]) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id: committeeId },
      include: {
        members: true,
        external_reviewers: true,
      },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: { student: true },
    });

    // Get all internal committee members' teacher IDs
    const excludedTeacherIds = committee.members.map((m) => m.teacher_id);

    for (const project of projects) {
      // Check if any excluded teacher is the supervisor
      if (excludedTeacherIds.includes(project.teacher_id)) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: project.teacher_id },
        });
        throw new ForbiddenException(
          `Giảng viên "${teacher?.name}" đang hướng dẫn đề tài "${project.project_name}" và không thể ngồi trong hội đồng chấm đề tài này`,
        );
      }
    }

    return projects;
  }

  async createDefenseSession(dto: CreateDefenseSessionDto) {
    // Verify committee exists
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id: dto.committee_id, deleted_at: null },
    });

    if (!committee) {
      throw new NotFoundException('Hội đồng không tồn tại');
    }

    // Validate project assignments if provided
    let projects: any[] = [];
    if (dto.project_ids && dto.project_ids.length > 0) {
      projects = await this.validateProjectAssignments(dto.committee_id, dto.project_ids);
    }

    // Create session
    const session = await this.prisma.defenseSession.create({
      data: {
        committee_id: dto.committee_id,
        defense_date: new Date(dto.defense_date),
        start_time: dto.start_time,
        room: dto.room,
        duration_minutes: dto.duration_minutes || 15,
        status: DefenseSessionStatus.SCHEDULED,
      },
    });

    // Add projects to session
    if (dto.project_ids && dto.project_ids.length > 0) {
      const times = this.calculateProjectTimes(
        dto.start_time,
        dto.project_ids.length,
        dto.duration_minutes || 15,
      );

      await this.prisma.defenseSessionProject.createMany({
        data: dto.project_ids.map((projectId, index) => ({
          session_id: session.id,
          project_id: projectId,
          order_index: index + 1,
          scheduled_time: times[index],
        })),
      });
    }

    return this.getDefenseSessionById(session.id);
  }

  async getDefenseSessions(query: DefenseSessionQueryDto) {
    const { page = 1, limit = 20, committee_id, status, defense_date, room } = query;

    const where: any = { deleted_at: null };
    if (committee_id) where.committee_id = committee_id;
    if (status) where.status = status;
    if (room) where.room = room;
    if (defense_date) {
      const date = new Date(defense_date);
      where.defense_date = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.defenseSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { defense_date: 'desc' },
      }),
      this.prisma.defenseSession.count({ where }),
    ]);

    const enrichedData = await Promise.all(
      data.map((s) => this.enrichSession(s)),
    );

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDefenseSessionById(id: number) {
    const session = await this.prisma.defenseSession.findFirst({
      where: { id, deleted_at: null },
    });

    if (!session) {
      throw new NotFoundException('Phiên bảo vệ không tồn tại');
    }

    return this.enrichSession(session);
  }

  private async enrichSession(session: any) {
    const committee = await this.prisma.defenseCommittee.findFirst({
      where: { id: session.committee_id },
    });

    const sessionProjects = await this.prisma.defenseSessionProject.findMany({
      where: { session_id: session.id },
      orderBy: { order_index: 'asc' },
    });

    const projects = await Promise.all(
      sessionProjects.map(async (sp) => {
        const project = await this.prisma.project.findUnique({
          where: { id: sp.project_id },
          include: { student: true },
        });
        return {
          project_id: sp.project_id,
          project_code: project?.project_id,
          project_name: project?.project_name,
          student_name: project?.student
            ? `${project.student.first_name} ${project.student.middle_name} ${project.student.last_name}`
            : '',
          student_mssv: project?.student?.student_id,
          order_index: sp.order_index,
          scheduled_time: sp.scheduled_time,
          score: sp.score,
          defense_notes: sp.defense_notes,
          defended_at: sp.defended_at,
        };
      }),
    );

    const endTime = this.calculateEndTime(
      session.start_time,
      projects.length,
      session.duration_minutes,
    );

    return {
      id: session.id,
      committee_id: session.committee_id,
      committee_name: committee?.name || '',
      defense_date: session.defense_date,
      start_time: session.start_time,
      end_time: endTime,
      room: session.room,
      duration_minutes: session.duration_minutes,
      status: session.status,
      projects,
      project_count: projects.length,
      estimated_end_time: endTime,
      created_at: session.created_at,
      updated_at: session.updated_at,
    };
  }

  async updateDefenseSession(id: number, dto: UpdateDefenseSessionDto) {
    const session = await this.prisma.defenseSession.findFirst({
      where: { id, deleted_at: null },
    });

    if (!session) {
      throw new NotFoundException('Phiên bảo vệ không tồn tại');
    }

    if (session.status === DefenseSessionStatus.COMPLETED) {
      throw new BadRequestException('Không thể cập nhật phiên bảo vệ đã hoàn thành');
    }

    const updated = await this.prisma.defenseSession.update({
      where: { id },
      data: {
        defense_date: dto.defense_date ? new Date(dto.defense_date) : undefined,
        start_time: dto.start_time,
        room: dto.room,
        status: dto.status,
        duration_minutes: dto.duration_minutes,
      },
    });

    // Recalculate project times if start_time changed
    if (dto.start_time) {
      const sessionProjects = await this.prisma.defenseSessionProject.findMany({
        where: { session_id: id },
        orderBy: { order_index: 'asc' },
      });

      const times = this.calculateProjectTimes(
        dto.start_time,
        sessionProjects.length,
        updated.duration_minutes,
      );

      for (let i = 0; i < sessionProjects.length; i++) {
        await this.prisma.defenseSessionProject.update({
          where: { id: sessionProjects[i].id },
          data: { scheduled_time: times[i] },
        });
      }
    }

    return this.getDefenseSessionById(id);
  }

  async addProjectsToSession(id: number, dto: AddProjectsToSessionDto) {
    const session = await this.prisma.defenseSession.findFirst({
      where: { id, deleted_at: null },
    });

    if (!session) {
      throw new NotFoundException('Phiên bảo vệ không tồn tại');
    }

    // Validate project assignments
    await this.validateProjectAssignments(session.committee_id, dto.project_ids);

    // Get current max order index
    const lastProject = await this.prisma.defenseSessionProject.findFirst({
      where: { session_id: id },
      orderBy: { order_index: 'desc' },
    });

    const startIndex = lastProject ? lastProject.order_index + 1 : 1;
    const startTimeMinutes = this.parseTime(session.start_time);
    const times = this.calculateProjectTimes(
      session.start_time,
      dto.project_ids.length,
      session.duration_minutes,
    );

    // Add new projects
    await this.prisma.defenseSessionProject.createMany({
      data: dto.project_ids.map((projectId, index) => ({
        session_id: id,
        project_id: projectId,
        order_index: startIndex + index,
        scheduled_time: times[index],
      })),
      skipDuplicates: true,
    });

    return this.getDefenseSessionById(id);
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async removeProjectFromSession(id: number, projectId: number) {
    const sessionProject = await this.prisma.defenseSessionProject.findFirst({
      where: {
        session_id: id,
        project_id: projectId,
      },
    });

    if (!sessionProject) {
      throw new NotFoundException('Đề tài không có trong phiên bảo vệ này');
    }

    // Check if already scored
    const scores = await this.prisma.defenseScore.findMany({
      where: { session_project_id: sessionProject.id },
    });

    if (scores.length > 0) {
      throw new BadRequestException('Đề tài đã được chấm điểm, không thể xóa');
    }

    await this.prisma.defenseSessionProject.delete({
      where: { id: sessionProject.id },
    });

    // Reorder remaining projects
    const remainingProjects = await this.prisma.defenseSessionProject.findMany({
      where: { session_id: id },
      orderBy: { order_index: 'asc' },
    });

    const times = this.calculateProjectTimes(
      (await this.prisma.defenseSession.findFirst({ where: { id } }))!.start_time,
      remainingProjects.length,
      (await this.prisma.defenseSession.findFirst({ where: { id } }))!.duration_minutes,
    );

    for (let i = 0; i < remainingProjects.length; i++) {
      await this.prisma.defenseSessionProject.update({
        where: { id: remainingProjects[i].id },
        data: {
          order_index: i + 1,
          scheduled_time: times[i],
        },
      });
    }

    return this.getDefenseSessionById(id);
  }

  async scoreProject(sessionProjectId: number, dto: ScoreProjectDto) {
    const sessionProject = await this.prisma.defenseSessionProject.findFirst({
      where: { id: sessionProjectId },
    });

    if (!sessionProject) {
      throw new NotFoundException('Đề tài bảo vệ không tồn tại');
    }

    // Check if session is in valid state
    const session = await this.prisma.defenseSession.findFirst({
      where: { id: sessionProject.session_id },
    });

    if (session?.status === DefenseSessionStatus.CANCELLED) {
      throw new BadRequestException('Phiên bảo vệ đã bị hủy');
    }

    // Create or update score
    const existingScore = await this.prisma.defenseScore.findFirst({
      where: {
        session_project_id: sessionProjectId,
        teacher_id: dto.teacher_id,
      },
    });

    if (existingScore) {
      return this.prisma.defenseScore.update({
        where: { id: existingScore.id },
        data: {
          score: dto.score,
          notes: dto.notes,
        },
      });
    }

    return this.prisma.defenseScore.create({
      data: {
        session_project_id: sessionProjectId,
        teacher_id: dto.teacher_id,
        role: dto.role as any,
        score: dto.score,
        notes: dto.notes,
      },
    });
  }

  async completeDefenseSession(id: number) {
    const session = await this.prisma.defenseSession.findFirst({
      where: { id, deleted_at: null },
    });

    if (!session) {
      throw new NotFoundException('Phiên bảo vệ không tồn tại');
    }

    // Mark all projects as defended
    const sessionProjects = await this.prisma.defenseSessionProject.findMany({
      where: { session_id: id },
    });

    for (const sp of sessionProjects) {
      // Calculate average score
      const scores = await this.prisma.defenseScore.findMany({
        where: { session_project_id: sp.id },
      });

      if (scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        await this.prisma.defenseSessionProject.update({
          where: { id: sp.id },
          data: {
            score: avgScore,
            defended_at: new Date(),
          },
        });
      }
    }

    return this.prisma.defenseSession.update({
      where: { id },
      data: { status: DefenseSessionStatus.COMPLETED },
    });
  }

  async deleteDefenseSession(id: number) {
    const session = await this.prisma.defenseSession.findFirst({
      where: { id, deleted_at: null },
    });

    if (!session) {
      throw new NotFoundException('Phiên bảo vệ không tồn tại');
    }

    // Check for existing scores
    const sessionProjects = await this.prisma.defenseSessionProject.findMany({
      where: { session_id: id },
    });

    for (const sp of sessionProjects) {
      const scores = await this.prisma.defenseScore.findMany({
        where: { session_project_id: sp.id },
      });

      if (scores.length > 0) {
        throw new BadRequestException(
          'Phiên bảo vệ đã có điểm, không thể xóa. Vui lòng hủy phiên thay thế.',
        );
      }
    }

    // Soft delete session and projects
    await this.prisma.defenseSessionProject.deleteMany({
      where: { session_id: id },
    });

    return this.prisma.defenseSession.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async exportScheduleWord(sessionId: number) {
    const session = await this.getDefenseSessionById(sessionId);
    
    // Generate Word document content (in real scenario, use a library like docx)
    // For now, return structured data that frontend can use to generate Word
    return {
      document_type: 'LICH_BAO_VE',
      session_id: session.id,
      committee_name: session.committee_name,
      date: new Date(session.defense_date).toLocaleDateString('vi-VN'),
      room: session.room,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_per_topic: session.duration_minutes,
      projects: session.projects.map((p) => ({
        order: p.order_index,
        time: p.scheduled_time,
        project_code: p.project_code,
        project_name: p.project_name,
        student_name: p.student_name,
        student_mssv: p.student_mssv,
      })),
    };
  }

  async getStats() {
    const [sessions, completedSessions, scores] = await Promise.all([
      this.prisma.defenseSession.count({ where: { deleted_at: null } }),
      this.prisma.defenseSession.count({
        where: { status: DefenseSessionStatus.COMPLETED, deleted_at: null },
      }),
      this.prisma.defenseScore.findMany(),
    ]);

    const scheduled = await this.prisma.defenseSession.count({
      where: { status: DefenseSessionStatus.SCHEDULED, deleted_at: null },
    });
    const cancelled = await this.prisma.defenseSession.count({
      where: { status: DefenseSessionStatus.CANCELLED, deleted_at: null },
    });

    const sessionProjects = await this.prisma.defenseSessionProject.findMany({
      where: { defended_at: { not: null } },
    });

    const scoresWithValue = scores.filter((s) => s.score !== null);
    const avgScore =
      scoresWithValue.length > 0
        ? scoresWithValue.reduce((sum, s) => sum + s.score, 0) / scoresWithValue.length
        : null;

    return {
      total_sessions: sessions,
      scheduled,
      completed: completedSessions,
      cancelled,
      total_projects_defended: sessionProjects.length,
      average_score: avgScore ? Math.round(avgScore * 100) / 100 : null,
    };
  }
}
