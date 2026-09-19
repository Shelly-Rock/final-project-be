import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PrismaService } from '@core/database/prisma/prisma.service';
import {
  Prisma,
  ScoringType,
  ScoringStatus,
  CommitteeRole,
} from '@prisma/client';
import {
  CreateIndependentScoreDto,
  UpdateScoreDto,
  SubmitScoreDto,
  QueryScoresDto,
  QueryMyScoresDto,
  QueryMeetingsDto,
  AdjustMeetingScoreDto,
  QueryTranscriptsDto,
  UpdateBonusScoreDto,
  QueryPostDefenseDto,
  SetRevisionWindowDto,
  SubmitRevisionDto,
  UpdateRankDto,
} from './scoring.dto';

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ SCORE MANAGEMENT ============

  async createScore(dto: CreateIndependentScoreDto) {
    const { projectId, studentId, teacherId, scoringType, role } = dto;

    const deadline = new Date();
    deadline.setDate(
      deadline.getDate() + (scoringType === ScoringType.GVHD ? 7 : 3),
    );

    const existing = await this.prisma.independent_scores.findFirst({
      where: {
        project_id: projectId,
        teacher_id: teacherId,
        scoring_type: scoringType,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Score record already exists for this project and teacher',
      );
    }

    return this.prisma.independent_scores.create({
      data: {
        project_id: projectId,
        student_id: studentId,
        teacher_id: teacherId,
        scoring_type: scoringType,
        role: role || null,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
        updated_at: new Date(),
      },
    });
  }

  async updateScore(id: number, userId: number, dto: UpdateScoreDto) {
    const score = await this.prisma.independent_scores.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    const teacherId = await this.resolveTeacherId(userId, false);
    if (teacherId && score.teacher_id !== teacherId) {
      throw new ForbiddenException(
        'You are not authorized to update this score',
      );
    }
    if (!teacherId && userId !== 0) {
      throw new ForbiddenException(
        'You are not authorized to update this score',
      );
    }

    if (score.deadline && new Date() > score.deadline) {
      throw new BadRequestException('Đã quá thời hạn chấm điểm');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Cannot update a submitted score');
    }

    return this.prisma.independent_scores.update({
      where: { id },
      data: {
        score: dto.score,
        max_score: dto.maxScore,
        criteria_scores: dto.criteriaScores,
        status: dto.status,
        notes: dto.notes,
        strengths: dto.strengths,
        weaknesses: dto.weaknesses,
      },
    });
  }

  async submitScore(id: number, userId: number, dto: SubmitScoreDto) {
    const score = await this.prisma.independent_scores.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    const teacherId = await this.resolveTeacherId(userId);
    if (score.teacher_id !== teacherId) {
      throw new ForbiddenException(
        'You are not authorized to submit this score',
      );
    }

    if (score.deadline && new Date() > score.deadline) {
      throw new BadRequestException('Đã quá thời hạn chấm điểm');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Score already submitted');
    }

    const isFailed = dto.score < 4;

    const updatedScore = await this.prisma.independent_scores.update({
      where: { id },
      data: {
        score: dto.score,
        max_score: dto.maxScore || 10,
        criteria_scores: dto.criteriaScores,
        notes: dto.notes,
        strengths: dto.strengths,
        weaknesses: dto.weaknesses,
        status: isFailed ? ScoringStatus.FAILED : ScoringStatus.SUBMITTED,
        submitted_at: new Date(),
      },
    });

    // Update scoring result
    await this.updateScoringResult(
      score.project_id,
      score.scoring_type,
      dto.score,
    );

    return updatedScore;
  }

  async updateScoringResult(
    projectId: number,
    scoringType: ScoringType,
    score: number,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;

    let result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });

    if (!result) {
      result = await this.prisma.scoring_results.create({
        data: {
          project_id: projectId,
          student_id: project.student_id,
          updated_at: new Date(),
        },
      });
    }

    const isPassed = score >= 4;
    const updateData: Prisma.scoring_resultsUpdateInput = {};

    if (scoringType === ScoringType.GVHD) {
      updateData.gvhd_score = score;
      updateData.is_gvhd_passed = isPassed;

      if (!isPassed) {
        updateData.final_status = 'REJECTED_GVHD';
      }
    } else {
      // Committee score - get all committee scores from IndependentScore table
      const committeeScores = await this.prisma.independent_scores.findMany({
        where: {
          project_id: projectId,
          scoring_type: ScoringType.COMMITTEE,
          status: {
            in: [
              ScoringStatus.SUBMITTED,
              ScoringStatus.FAILED,
              ScoringStatus.PASSED,
            ],
          },
          score: { not: null },
        },
      });

      // Calculate average defense score
      if (committeeScores.length > 0) {
        const totalScore = committeeScores.reduce(
          (sum, s) => sum + (s.score || 0),
          0,
        );
        updateData.defense_score = totalScore / committeeScores.length;
      }
    }

    // Calculate final score if both GVHD and defense scores are available
    const allScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        status: ScoringStatus.SUBMITTED,
      },
    });

    const gvhdScore = allScores.find(
      (s) => s.scoring_type === ScoringType.GVHD,
    );
    const allCommitteeScores = allScores.filter(
      (s) => s.scoring_type === ScoringType.COMMITTEE,
    );

    if (
      gvhdScore &&
      gvhdScore.score !== null &&
      allCommitteeScores.length > 0
    ) {
      const avgCommittee =
        allCommitteeScores.reduce((sum, s) => sum + (s.score || 0), 0) /
        allCommitteeScores.length;
      updateData.final_score = ((gvhdScore.score || 0) + avgCommittee) / 2;
    }

    return this.prisma.scoring_results.update({
      where: { project_id: projectId },
      data: updateData,
    });
  }

  // ============ QUERIES ============

  async getScoreById(id: number) {
    const score = await this.prisma.independent_scores.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            project_id: true,
            project_name: true,
          },
        },
        students: {
          select: {
            student_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            class_name: true,
          },
        },
        teachers: {
          select: {
            teacher_id: true,
            name: true,
          },
        },
      },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    return score;
  }

  async getMyScores(userId: number, query: QueryMyScoresDto) {
    const teacherId = await this.resolveTeacherId(userId);
    const { page = 1, limit = 20, status, scoringType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.independent_scoresWhereInput = {
      teacher_id: teacherId,
    };

    if (status) {
      where.status = status;
    }

    if (scoringType) {
      where.scoring_type = scoringType;
    }

    const [scores, total] = await Promise.all([
      this.prisma.independent_scores.findMany({
        where,
        include: {
          projects: {
            select: {
              project_id: true,
              project_name: true,
            },
          },
          students: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.independent_scores.count({ where }),
    ]);

    return {
      data: scores.map((s) => ({
        id: s.id,
        projectId: s.project_id,
        studentId: s.student_id,
        teacherId: s.teacher_id,
        scoringType: s.scoring_type,
        role: s.role,
        score: s.score,
        maxScore: s.max_score,
        criteriaScores: s.criteria_scores,
        status: s.status,
        deadline: s.deadline,
        submittedAt: s.submitted_at,
        notes: s.notes,
        strengths: s.strengths,
        weaknesses: s.weaknesses,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        project: (s as any).projects
          ? {
              projectId: (s as any).projects.project_id,
              projectCode: (s as any).projects.project_id,
              projectName: (s as any).projects.project_name,
            }
          : undefined,
        student: (s as any).students
          ? {
              studentId: (s as any).students.student_id,
              firstName: (s as any).students.first_name,
              middleName: (s as any).students.middle_name,
              lastName: (s as any).students.last_name,
              className: (s as any).students.class_name,
            }
          : undefined,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getScoresByProject(projectId: number) {
    return this.prisma.independent_scores.findMany({
      where: { project_id: projectId },
      include: {
        teachers: {
          select: {
            teacher_id: true,
            name: true,
          },
        },
      },
      orderBy: { scoring_type: 'asc' },
    });
  }

  async getScores(query: QueryScoresDto) {
    const {
      page = 1,
      limit = 20,
      scoringType,
      status,
      teacherId,
      projectId,
      studentId,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.independent_scoresWhereInput = {};

    if (scoringType) where.scoring_type = scoringType;
    if (status) where.status = status;
    if (teacherId) where.teacher_id = teacherId;
    if (projectId) where.project_id = projectId;
    if (studentId) where.student_id = studentId;

    const [scores, total] = await Promise.all([
      this.prisma.independent_scores.findMany({
        where,
        include: {
          projects: {
            select: {
              project_id: true,
              project_name: true,
            },
          },
          students: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
          teachers: {
            select: {
              teacher_id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.independent_scores.count({ where }),
    ]);

    return {
      data: scores,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyStats(userId: number) {
    const teacherId = await this.resolveTeacherId(userId, false);
    if (!teacherId) {
      return { total: 0, pending: 0, submitted: 0, failed: 0, passed: 0 };
    }

    const scores = await this.prisma.independent_scores.findMany({
      where: { teacher_id: teacherId },
    });

    return {
      total: scores.length,
      pending: scores.filter(
        (s) =>
          s.status === ScoringStatus.PENDING ||
          s.status === ScoringStatus.IN_PROGRESS,
      ).length,
      submitted: scores.filter((s) => s.status === ScoringStatus.SUBMITTED)
        .length,
      failed: scores.filter((s) => s.status === ScoringStatus.FAILED).length,
      passed: scores.filter((s) => s.status === ScoringStatus.PASSED).length,
    };
  }

  // ============ SCORING RESULTS ============

  async getScoringResult(projectId: number) {
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });

    if (!result) {
      return null;
    }

    // Get individual scores for detailed view
    const scores = await this.prisma.independent_scores.findMany({
      where: { project_id: projectId },
      include: {
        teachers: {
          select: {
            teacher_id: true,
            name: true,
          },
        },
      },
    });

    const committeeScoresList = scores
      .filter((s) => s.scoring_type === ScoringType.COMMITTEE)
      .map((s) => ({
        role: s.role,
        teacherId: s.teacher_id,
        teacherName: s.teachers.name,
        score: s.score,
        passed: s.score !== null && s.score >= 4,
      }));

    const gvhdScore = scores.find((s) => s.scoring_type === ScoringType.GVHD);

    return {
      id: result.id,
      projectId: result.project_id,
      studentId: result.student_id,
      gvhdScore: gvhdScore?.score || null,
      gvhdPassed: result.is_gvhd_passed,
      reviewScore: result.review_score,
      defenseScore: result.defense_score,
      finalScore: result.final_score,
      committeeScores: committeeScoresList,
      totalCommitteeScores: committeeScoresList.length,
      isFinalPassed: result.is_final_passed,
      finalStatus: result.final_status,
      scoreSheetUrl: result.score_sheet_url,
    };
  }

  async getAllScoringResults(query: QueryScoresDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const results = await this.prisma.scoring_results.findMany({
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.scoring_results.count();

    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const project = await this.prisma.project.findUnique({
          where: { id: result.project_id },
          select: {
            project_id: true,
            project_name: true,
          },
        });

        const student = await this.prisma.student.findUnique({
          where: { id: result.student_id },
          select: {
            student_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
          },
        });

        return {
          ...result,
          project,
          student,
        };
      }),
    );

    return {
      data: enrichedResults,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============ ASSIGN SCORES TO COMMITTEE ============

  async assignScoresToCommittee(sessionProjectId: number, committeeId: number) {
    const sessionProject =
      await this.prisma.defense_session_projects.findUnique({
        where: { id: sessionProjectId },
        include: {
          projects: true,
        },
      });

    if (!sessionProject) {
      throw new NotFoundException('Session project not found');
    }

    // Get committee members using the new CommitteeMember table
    const committee = await this.prisma.defense_committees.findUnique({
      where: { id: committeeId },
      include: {
        committee_members: {
          include: {
            teachers: true,
          },
        },
        committee_external_reviewers: {
          include: {
            teachers: true,
          },
        },
      },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);

    const scoresToCreate = [];

    // Add internal members
    for (const member of committee.committee_members) {
      scoresToCreate.push({
        project_id: sessionProject.projects.id,
        student_id: sessionProject.projects.student_id,
        teacher_id: member.teacher_id,
        scoring_type: ScoringType.COMMITTEE,
        role: member.role,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Add external reviewers
    for (const reviewer of committee.committee_external_reviewers) {
      scoresToCreate.push({
        project_id: sessionProject.projects.id,
        student_id: sessionProject.projects.student_id,
        teacher_id: reviewer.teacher_id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.EXTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Create all scores
    return this.prisma.independent_scores.createMany({
      data: scoresToCreate,
      skipDuplicates: true,
    });
  }

  // ============ DELETE ============

  async deleteScore(id: number) {
    const score = await this.prisma.independent_scores.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Cannot delete a submitted score');
    }

    return this.prisma.independent_scores.delete({
      where: { id },
    });
  }

  // ============ GIAI ĐOẠN 5: HỌP VÀ CHỐT ĐIỂM HỘI ĐỒNG ============

  async getMeetings(userId: number, role: string, query: QueryMeetingsDto) {
    const { page = 1, limit = 20, finalized } = query;
    const skip = (page - 1) * limit;
    const staff = this.isStaff(role);

    const where: Prisma.independent_scoresWhereInput = {
      scoring_type: ScoringType.COMMITTEE,
    };

    if (!staff) {
      const teacherId = await this.resolveTeacherId(userId);
      where.teacher_id = teacherId;
    }

    const grouped = await this.prisma.independent_scores.groupBy({
      by: ['project_id'],
      where,
    });

    const allProjectIds = grouped.map((g) => g.project_id);

    const results = await this.prisma.scoring_results.findMany({
      where: { project_id: { in: allProjectIds } },
    });
    const resultByProject = new Map(results.map((r) => [r.project_id, r]));

    const filteredIds = allProjectIds.filter((projectId) => {
      if (finalized === undefined) return true;
      return this.isFinalized(resultByProject.get(projectId)) === finalized;
    });

    const pageIds = filteredIds.slice(skip, skip + limit);

    const [projects, committeeScores] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: pageIds } },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
        },
      }),
      this.prisma.independent_scores.findMany({
        where: {
          project_id: { in: pageIds },
          scoring_type: ScoringType.COMMITTEE,
        },
        include: {
          teachers: { select: { teacher_id: true, name: true } },
        },
      }),
    ]);

    const scoresByProject = new Map<number, typeof committeeScores>();
    for (const score of committeeScores) {
      const list = scoresByProject.get(score.project_id) ?? [];
      list.push(score);
      scoresByProject.set(score.project_id, list);
    }

    const data = pageIds.map((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      const scores = scoresByProject.get(projectId) ?? [];
      const scored = scores.filter((s) => s.score !== null);
      const avg =
        scored.length > 0
          ? scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length
          : null;
      const result = resultByProject.get(projectId);
      const student = project?.student;

      return {
        projectId,
        projectCode: project?.project_id ?? '',
        projectName: project?.project_name ?? '',
        student: student
          ? {
              studentId: student.student_id,
              firstName: student.first_name,
              middleName: student.middle_name,
              lastName: student.last_name,
              className: student.class_name,
            }
          : null,
        scoredCount: scored.length,
        totalCount: scores.length,
        defenseAverage: avg,
        finalScore: result?.final_score ?? null,
        finalStatus: result?.final_status ?? null,
        isFinalized: this.isFinalized(result),
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total: filteredIds.length,
        totalPages: Math.ceil(filteredIds.length / limit),
      },
    };
  }

  async getMeeting(projectId: number, userId: number, role: string) {
    const access = await this.assertMeetingAccess(projectId, userId, role);

    const [project, scores, result] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
        },
      }),
      this.prisma.independent_scores.findMany({
        where: { project_id: projectId },
        include: {
          teachers: { select: { teacher_id: true, name: true } },
        },
        orderBy: { role: 'asc' },
      }),
      this.prisma.scoring_results.findUnique({
        where: { project_id: projectId },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const committeeScores = scores.filter(
      (s) => s.scoring_type === ScoringType.COMMITTEE,
    );
    const gvhd = scores.find((s) => s.scoring_type === ScoringType.GVHD);
    const scored = committeeScores.filter((s) => s.score !== null);
    const defenseAverage =
      scored.length > 0
        ? scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length
        : null;
    const gvhdScore = gvhd?.score ?? result?.gvhd_score ?? null;
    const finalScorePreview =
      gvhdScore !== null && defenseAverage !== null
        ? (gvhdScore + defenseAverage) / 2
        : null;

    const student = project.student;
    const isFinalized = this.isFinalized(result);

    return {
      projectId: project.id,
      projectCode: project.project_id,
      projectName: project.project_name,
      student: student
        ? {
            studentId: student.student_id,
            firstName: student.first_name,
            middleName: student.middle_name,
            lastName: student.last_name,
            className: student.class_name,
          }
        : null,
      gvhdScore: gvhd
        ? {
            id: gvhd.id,
            teacherId: gvhd.teacher_id,
            teacherName: gvhd.teachers.name,
            score: gvhd.score,
            status: gvhd.status,
            notes: gvhd.notes,
          }
        : null,
      committeeScores: committeeScores.map((s) => ({
        id: s.id,
        teacherId: s.teacher_id,
        teacherName: s.teachers.name,
        teacherCode: s.teachers.teacher_id,
        role: s.role,
        score: s.score,
        maxScore: s.max_score,
        criteriaScores: s.criteria_scores,
        status: s.status,
        notes: s.notes,
        strengths: s.strengths,
        weaknesses: s.weaknesses,
        submittedAt: s.submitted_at,
        canEdit:
          !isFinalized &&
          (access.canEditAll || s.teacher_id === access.teacherId),
      })),
      defenseAverage,
      finalScorePreview: result?.final_score ?? finalScorePreview,
      gvhdPassed:
        result?.is_gvhd_passed ?? (gvhdScore !== null ? gvhdScore >= 4 : null),
      finalStatus: result?.final_status ?? null,
      isFinalPassed: result?.is_final_passed ?? false,
      isFinalized,
      canEditAll: access.canEditAll && !isFinalized,
      canFinalize: access.canFinalize && !isFinalized,
      currentTeacherId: access.teacherId,
    };
  }

  async adjustMeetingScore(
    scoreId: number,
    userId: number,
    role: string,
    dto: AdjustMeetingScoreDto,
  ) {
    const score = await this.prisma.independent_scores.findUnique({
      where: { id: scoreId },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    if (score.scoring_type !== ScoringType.COMMITTEE) {
      throw new BadRequestException(
        'Chỉ được sửa điểm hội đồng trong phiên họp',
      );
    }

    const access = await this.assertMeetingAccess(
      score.project_id,
      userId,
      role,
    );
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: score.project_id },
    });

    if (this.isFinalized(result)) {
      throw new BadRequestException('Điểm hội đồng đã chốt, không thể sửa');
    }

    if (!access.canEditAll && score.teacher_id !== access.teacherId) {
      throw new ForbiddenException('Bạn chỉ được sửa điểm của mình');
    }

    const isFailed = dto.score < 4;
    const updated = await this.prisma.independent_scores.update({
      where: { id: scoreId },
      data: {
        score: dto.score,
        max_score: dto.maxScore ?? score.max_score,
        criteria_scores:
          (dto.criteriaScores as Prisma.JsonValue) ?? score.criteria_scores,
        notes: dto.notes ?? score.notes,
        strengths: dto.strengths ?? score.strengths,
        weaknesses: dto.weaknesses ?? score.weaknesses,
        status: isFailed ? ScoringStatus.FAILED : ScoringStatus.SUBMITTED,
        submitted_at: score.submitted_at ?? new Date(),
      },
      include: {
        teachers: { select: { teacher_id: true, name: true } },
      },
    });

    await this.updateScoringResult(
      score.project_id,
      ScoringType.COMMITTEE,
      dto.score,
    );

    return {
      id: updated.id,
      teacherId: updated.teacher_id,
      teacherName: updated.teachers.name,
      role: updated.role,
      score: updated.score,
      status: updated.status,
      notes: updated.notes,
      strengths: updated.strengths,
      weaknesses: updated.weaknesses,
    };
  }

  async finalizeMeeting(projectId: number, userId: number, role: string) {
    const access = await this.assertMeetingAccess(projectId, userId, role);
    if (!access.canFinalize) {
      throw new ForbiddenException('Bạn không có quyền chốt điểm hội đồng');
    }

    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });

    if (this.isFinalized(result)) {
      throw new BadRequestException('Điểm hội đồng đã được chốt');
    }

    if (
      result?.final_status === 'REJECTED_GVHD' ||
      result?.is_gvhd_passed === false
    ) {
      throw new BadRequestException(
        'GVHD chưa đạt, không thể chốt điểm hội đồng',
      );
    }

    const committeeScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        scoring_type: ScoringType.COMMITTEE,
      },
    });

    if (committeeScores.length === 0) {
      throw new BadRequestException('Đề tài chưa có phiếu chấm hội đồng');
    }

    const missing = committeeScores.filter((s) => s.score === null);
    if (missing.length > 0) {
      throw new BadRequestException(
        'Tất cả thành viên hội đồng phải có điểm trước khi chốt',
      );
    }

    if (committeeScores.length < 3) {
      throw new BadRequestException(
        'Cần tối thiểu 3 thành viên hội đồng để chốt điểm',
      );
    }

    const defenseScore =
      committeeScores.reduce((sum, s) => sum + (s.score || 0), 0) /
      committeeScores.length;
    const failedCount = committeeScores.filter(
      (s) => (s.score || 0) < 4,
    ).length;
    const passed = failedCount === 0;

    const gvhd =
      result?.gvhd_score ??
      (
        await this.prisma.independent_scores.findFirst({
          where: { project_id: projectId, scoring_type: ScoringType.GVHD },
        })
      )?.score ??
      null;

    const finalScore = gvhd !== null ? (gvhd + defenseScore) / 2 : defenseScore;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      for (const score of committeeScores) {
        await tx.independent_scores.update({
          where: { id: score.id },
          data: {
            status:
              (score.score || 0) < 4
                ? ScoringStatus.FAILED
                : ScoringStatus.PASSED,
            submitted_at: score.submitted_at ?? new Date(),
          },
        });
      }

      return tx.scoring_results.upsert({
        where: { project_id: projectId },
        create: {
          project_id: projectId,
          student_id: project.student_id,
          gvhd_score: gvhd,
          is_gvhd_passed: gvhd === null ? false : gvhd >= 4,
          defense_score: defenseScore,
          final_score: finalScore,
          is_final_passed: passed,
          final_status: passed ? 'PASSED' : 'REJECTED_DEFENSE',
          updated_at: new Date(),
        },
        update: {
          defense_score: defenseScore,
          final_score: finalScore,
          is_final_passed: passed,
          final_status: passed ? 'PASSED' : 'REJECTED_DEFENSE',
        },
      });
    });

    return {
      projectId,
      defenseScore: saved.defense_score,
      finalScore: saved.final_score,
      isFinalPassed: saved.is_final_passed,
      finalStatus: saved.final_status,
      isFinalized: true,
    };
  }

  // ============ GIAI ĐOẠN 6: TÍNH ĐIỂM TỔNG HỢP + CÔNG BỐ BẢNG ĐIỂM ============
  // Điểm tổng = GVHD 40% + Phản biện ngoài 20% + TB 3 TV còn lại 40% + điểm thưởng (<=3)

  private async buildTranscript(projectId: number) {
    const [project, scores, result] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
        },
      }),
      this.prisma.independent_scores.findMany({
        where: { project_id: projectId },
        include: {
          teachers: { select: { teacher_id: true, name: true } },
        },
      }),
      this.prisma.scoring_results.findUnique({
        where: { project_id: projectId },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!this.isFinalized(result)) {
      throw new BadRequestException(
        'Đề tài chưa chốt điểm hội đồng (Giai đoạn 5)',
      );
    }

    const gvhd = scores.find((s) => s.scoring_type === ScoringType.GVHD);
    const committee = scores.filter(
      (s) => s.scoring_type === ScoringType.COMMITTEE,
    );
    const external = committee.find(
      (s) => s.role === CommitteeRole.EXTERNAL_REVIEWER,
    );
    const others = committee.filter(
      (s) => s.role !== CommitteeRole.EXTERNAL_REVIEWER,
    );

    if (gvhd?.score === null || gvhd?.score === undefined) {
      throw new BadRequestException('Thiếu điểm giảng viên hướng dẫn');
    }
    if (external?.score === null || external?.score === undefined) {
      throw new BadRequestException('Thiếu điểm phản biện ngoài');
    }
    if (
      others.length < 3 ||
      others.some((s) => s.score === null || s.score === undefined)
    ) {
      throw new BadRequestException(
        'Cần đủ điểm của 3 thành viên hội đồng còn lại',
      );
    }

    const othersAverage =
      others.reduce((sum, s) => sum + (s.score || 0), 0) / others.length;
    const defenseAverage =
      committee.reduce((sum, s) => sum + (s.score || 0), 0) / committee.length;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const weightedScore = round2(
      (gvhd.score || 0) * 0.4 +
        (external.score || 0) * 0.2 +
        othersAverage * 0.4,
    );
    const bonusScore = result?.bonus_score ?? 0;
    const finalScore = Math.min(10, round2(weightedScore + bonusScore));
    const failedCount = committee.filter((s) => (s.score || 0) < 4).length;

    return {
      projectId: project.id,
      projectCode: project.project_id,
      projectName: project.project_name,
      student: project.student
        ? {
            studentId: project.student.student_id,
            firstName: project.student.first_name,
            middleName: project.student.middle_name,
            lastName: project.student.last_name,
            className: project.student.class_name,
          }
        : null,
      isFinalized: true,
      finalStatus: result?.final_status ?? null,
      isFinalPassed: (result?.is_final_passed ?? false) && finalScore >= 4,
      gvhdScore: gvhd.score,
      gvhdPassed: (gvhd.score || 0) >= 4,
      externalScore: external.score,
      externalTeacherName: external.teachers.name,
      otherScores: others.map((s) => ({
        teacherName: s.teachers.name,
        teacherCode: s.teachers.teacher_id,
        role: s.role,
        score: s.score,
      })),
      othersAverage: round2(othersAverage),
      defenseAverage: round2(defenseAverage),
      failedCount,
      weightedScore,
      bonusScore,
      bonusNote: result?.bonus_note ?? null,
      finalScore,
      comments: committee.map((s) => ({
        teacherName: s.teachers.name,
        role: s.role,
        notes: s.notes,
        strengths: s.strengths,
        weaknesses: s.weaknesses,
      })),
      isPublished: result?.is_published ?? false,
      publishedAt: result?.published_at ?? null,
    };
  }

  async getTranscripts(
    userId: number,
    role: string,
    query: QueryTranscriptsDto,
  ) {
    const { page = 1, limit = 20, published } = query;
    const staff = this.isStaff(role);

    let projectIds: number[];
    if (staff) {
      const results = await this.prisma.scoring_results.findMany({
        where: {
          OR: [
            { final_status: 'PASSED' },
            { final_status: 'REJECTED_DEFENSE' },
          ],
          ...(published !== undefined ? { is_published: published } : {}),
        },
        select: { project_id: true },
      });
      projectIds = results.map((r) => r.project_id);
    } else {
      const teacherId = await this.resolveTeacherId(userId);
      const mine = await this.prisma.independent_scores.findMany({
        where: { teacher_id: teacherId, scoring_type: ScoringType.COMMITTEE },
        select: { project_id: true },
      });
      projectIds = [...new Set(mine.map((m) => m.project_id))];
      if (published !== undefined) {
        const results = await this.prisma.scoring_results.findMany({
          where: { project_id: { in: projectIds }, is_published: published },
          select: { project_id: true },
        });
        const allowed = new Set(results.map((r) => r.project_id));
        projectIds = projectIds.filter((id) => allowed.has(id));
      }
    }

    const data: Awaited<ReturnType<ScoringService['buildTranscript']>>[] = [];
    for (const projectId of projectIds) {
      try {
        data.push(await this.buildTranscript(projectId));
      } catch {
        continue;
      }
    }

    const total = data.length;
    const start = (page - 1) * limit;
    return {
      data: data.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTranscript(projectId: number, userId: number, role: string) {
    const access = await this.assertMeetingAccess(projectId, userId, role);
    const detail = await this.buildTranscript(projectId);
    const isSecretary =
      access.staff || access.own?.role === CommitteeRole.SECRETARY;
    return {
      ...detail,
      canAwardBonus: isSecretary && !detail.isPublished,
      canPublish: access.canFinalize && !detail.isPublished,
    };
  }

  async updateBonusScore(
    projectId: number,
    userId: number,
    role: string,
    dto: UpdateBonusScoreDto,
  ) {
    const access = await this.assertMeetingAccess(projectId, userId, role);
    const isSecretary =
      access.staff || access.own?.role === CommitteeRole.SECRETARY;
    if (!isSecretary) {
      throw new ForbiddenException('Chỉ thư ký hội đồng được cộng điểm thưởng');
    }

    const detail = await this.buildTranscript(projectId);
    if (detail.isPublished) {
      throw new BadRequestException(
        'Bảng điểm đã công bố, không thể sửa điểm thưởng',
      );
    }
    const finalScore = Math.min(
      10,
      Math.round((detail.weightedScore + dto.bonusScore) * 100) / 100,
    );

    await this.prisma.scoring_results.update({
      where: { project_id: projectId },
      data: {
        bonus_score: dto.bonusScore,
        bonus_note: dto.bonusNote ?? null,
        bonus_by_teacher_id: access.teacherId,
        review_score: detail.externalScore,
        final_score: finalScore,
        is_final_passed: detail.finalStatus === 'PASSED' && finalScore >= 4,
      },
    });

    return this.buildTranscript(projectId);
  }

  async publishTranscript(projectId: number, userId: number, role: string) {
    const access = await this.assertMeetingAccess(projectId, userId, role);
    if (!access.canFinalize) {
      throw new ForbiddenException('Bạn không có quyền công bố bảng điểm');
    }

    const detail = await this.buildTranscript(projectId);

    await this.prisma.scoring_results.update({
      where: { project_id: projectId },
      data: {
        review_score: detail.externalScore,
        final_score: detail.finalScore,
        is_final_passed:
          detail.finalStatus === 'PASSED' && detail.finalScore >= 4,
        is_published: true,
        published_at: new Date(),
      },
    });

    return this.buildTranscript(projectId);
  }

  private async resolveOrCreateStudent(userId: number) {
    let student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
    });

    if (!student) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ForbiddenException('User not found');
      }

      const lastStudent = await this.prisma.student.findFirst({
        orderBy: { id: 'desc' },
        take: 1,
      });
      const nextStudentId = `SV${String((lastStudent?.id ?? 0) + 1).padStart(6, '0')}`;

      student = await this.prisma.student.create({
        data: {
          student_id: nextStudentId,
          user: { connect: { id: userId } },
          first_name: user.username?.split('_')[0] || 'Student',
          middle_name: '',
          last_name: user.username?.split('_')[1] || 'User',
          email: user.email,
          class_name: 'K10',
          major: 'KTPM',
          course_year: 10,
          academic_year: new Date().getFullYear().toString(),
          gender: 'MALE',
          date_of_birth: new Date('2000-01-01'),
        },
      });
    }

    return student;
  }

  async getMyTranscript(userId: number) {
    const student = await this.resolveOrCreateStudent(userId);

    const project = await this.prisma.project.findUnique({
      where: { student_id: student.id },
    });
    if (!project) {
      throw new NotFoundException('Bạn chưa có đề tài');
    }

    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: project.id },
    });
    if (!result?.is_published) {
      throw new NotFoundException('Bảng điểm chưa được công bố');
    }

    return this.buildTranscript(project.id);
  }

  // ============ GIAI ĐOẠN 7: HẬU KIỂM VÀ XẾP HẠNG ============
  // Chỉnh sửa hồ sơ theo nhận xét -> Xếp hạng (sort điểm, đồng điểm xử lý thủ công) -> In biểu mẫu.

  private defaultRevisionDeadline(publishedAt: Date | null) {
    const base = publishedAt ?? new Date();
    const deadline = new Date(base);
    deadline.setDate(deadline.getDate() + 14);
    return deadline;
  }

  async getPostDefenseList(
    _userId: number,
    role: string,
    query: QueryPostDefenseDto,
  ) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException('Chỉ thư ký hệ thống được xếp hạng');
    }
    const { page = 1, limit = 50 } = query;

    const results = await this.prisma.scoring_results.findMany({
      where: { is_published: true, final_status: 'PASSED' },
      include: {
        projects: {
          select: {
            project_id: true,
            project_name: true,
            thesis_revisions: {
              where: { deleted_at: null },
              orderBy: { submitted_at: 'desc' },
              take: 1,
            },
          },
        },
        students: {
          select: {
            student_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            class_name: true,
          },
        },
      },
    });

    // Auto-rank theo điểm tổng giảm dần; rank_override (thủ công) luôn thắng.
    const sorted = [...results].sort((a, b) => {
      const aRank = a.rank_override ?? a.rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.rank_override ?? b.rank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return (b.final_score ?? 0) - (a.final_score ?? 0);
    });

    const data = sorted.map((r) => {
      const rank = r.rank_override ?? r.rank ?? null;
      const latestRevision = r.projects.thesis_revisions[0] ?? null;
      return {
        projectId: r.project_id,
        projectCode: r.projects.project_id,
        projectName: r.projects.project_name,
        student: r.students
          ? {
              studentId: r.students.student_id,
              firstName: r.students.first_name,
              middleName: r.students.middle_name,
              lastName: r.students.last_name,
              className: r.students.class_name,
            }
          : null,
        finalScore: r.final_score ?? null,
        bonusScore: r.bonus_score ?? 0,
        rank,
        rankOverride: r.rank_override,
        rankNote: r.rank_note,
        revisionDeadline:
          r.revision_deadline ?? this.defaultRevisionDeadline(r.published_at),
        revisionCount: latestRevision ? 1 : 0,
        latestRevisionFile: latestRevision?.file_name ?? null,
      };
    });

    const total = data.length;
    const start = (page - 1) * limit;
    return {
      data: data.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async computeRankings(_userId: number, role: string) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException('Chỉ thư ký hệ thống được xếp hạng');
    }

    const results = await this.prisma.scoring_results.findMany({
      where: { is_published: true, final_status: 'PASSED' },
      select: {
        project_id: true,
        final_score: true,
        rank_override: true,
      },
    });

    // Những bản ghi đã có rank_override giữ nguyên; phần còn lại xếp theo điểm giảm dần
    // vào các slot trống.
    const overrideSlots = new Map<number, number>();
    for (const r of results) {
      if (r.rank_override) overrideSlots.set(r.project_id, r.rank_override);
    }
    const takenSlots = new Set(overrideSlots.values());

    const autoRanked = results
      .filter((r) => !overrideSlots.has(r.project_id))
      .sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));

    const rankByProject = new Map<number, number>(overrideSlots);
    let cursor = 1;
    for (const r of autoRanked) {
      while (takenSlots.has(cursor)) cursor += 1;
      rankByProject.set(r.project_id, cursor);
      cursor += 1;
    }

    const now = new Date();
    await this.prisma.$transaction(
      results.map((r) =>
        this.prisma.scoring_results.update({
          where: { project_id: r.project_id },
          data: {
            rank: rankByProject.get(r.project_id) ?? null,
            ranked_at: now,
          },
        }),
      ),
    );

    return { total: results.length, rankedAt: now };
  }

  async setRevisionWindow(
    projectId: number,
    _userId: number,
    role: string,
    dto: SetRevisionWindowDto,
  ) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException(
        'Chỉ thư ký hệ thống được đặt hạn chỉnh sửa',
      );
    }
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });
    if (!result) {
      throw new NotFoundException('Không tìm thấy kết quả chấm điểm');
    }
    await this.prisma.scoring_results.update({
      where: { project_id: projectId },
      data: { revision_deadline: new Date(dto.revisionDeadline) },
    });
    return { projectId, revisionDeadline: new Date(dto.revisionDeadline) };
  }

  async updateRank(
    projectId: number,
    _userId: number,
    role: string,
    dto: UpdateRankDto,
  ) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException(
        'Chỉ thư ký hệ thống được xếp hạng thủ công',
      );
    }
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });
    if (!result) {
      throw new NotFoundException('Không tìm thấy kết quả chấm điểm');
    }
    await this.prisma.scoring_results.update({
      where: { project_id: projectId },
      data: {
        rank_override: dto.rankOverride,
        rank: dto.rankOverride,
        rank_note: dto.rankNote ?? null,
      },
    });
    return {
      projectId,
      rank: dto.rankOverride,
      rankOverride: dto.rankOverride,
    };
  }

  async getPrintSheet(userId: number, role: string) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException(
        'Chỉ thư ký hệ thống được in bảng điểm lưu trữ',
      );
    }
    const rows = await this.getPostDefenseList(userId, role, {
      page: 1,
      limit: 1000,
    });
    return { data: rows.data, generatedAt: new Date() };
  }

  async getMyRevision(userId: number) {
    const student = await this.resolveOrCreateStudent(userId);
    const project = await this.prisma.project.findUnique({
      where: { student_id: student.id },
    });
    if (!project) {
      throw new NotFoundException('Bạn chưa có đề tài');
    }
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: project.id },
    });
    if (!result?.is_published) {
      throw new NotFoundException('Bảng điểm chưa được công bố');
    }

    const transcript = await this.buildTranscript(project.id);
    const deadline =
      result.revision_deadline ??
      this.defaultRevisionDeadline(result.published_at);
    const revision = await this.prisma.thesis_revisions.findFirst({
      where: { project_id: project.id, deleted_at: null },
      orderBy: { submitted_at: 'desc' },
    });

    return {
      ...transcript,
      revisionDeadline: deadline,
      canSubmitRevision: deadline.getTime() > Date.now(),
      revision: revision
        ? {
            id: revision.id,
            fileName: revision.file_name,
            fileUrl: revision.file_url,
            submittedAt: revision.submitted_at,
            note: revision.note,
          }
        : null,
    };
  }

  async submitRevision(userId: number, dto: SubmitRevisionDto) {
    const student = await this.resolveOrCreateStudent(userId);
    const project = await this.prisma.project.findUnique({
      where: { student_id: student.id },
    });
    if (!project) {
      throw new NotFoundException('Bạn chưa có đề tài');
    }
    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: project.id },
    });
    if (!result?.is_published) {
      throw new BadRequestException(
        'Bảng điểm chưa được công bố, chưa mở chỉnh sửa',
      );
    }
    const deadline =
      result.revision_deadline ??
      this.defaultRevisionDeadline(result.published_at);
    if (deadline.getTime() <= Date.now()) {
      throw new BadRequestException('Đã hết hạn chỉnh sửa hồ sơ');
    }

    return this.prisma.thesis_revisions.create({
      data: {
        project_id: project.id,
        student_id: student.id,
        file_url: dto.fileUrl,
        file_name: dto.fileName,
        original_name: dto.originalName,
        file_size: dto.fileSize,
        note: dto.note ?? null,
        updated_at: new Date(),
      },
    });
  }

  private isStaff(role?: string) {
    const normalized = (role || '').toLowerCase();
    return normalized === 'admin' || normalized === 'secretary';
  }

  private isFinalized(result?: { final_status?: string | null } | null) {
    return (
      result?.final_status === 'PASSED' ||
      result?.final_status === 'REJECTED_DEFENSE'
    );
  }

  private async resolveTeacherId(userId: number, required = true) {
    const byUser = await this.prisma.teacher.findUnique({
      where: { user_id: userId },
    });
    if (byUser) return byUser.id;

    const byId = await this.prisma.teacher.findUnique({
      where: { id: userId },
    });
    if (byId) return byId.id;

    if (required) {
      throw new ForbiddenException('Teacher profile not found');
    }
    return null;
  }

  private async assertMeetingAccess(
    projectId: number,
    userId: number,
    role: string,
  ) {
    const staff = this.isStaff(role);
    const teacherId = await this.resolveTeacherId(userId, false);

    const committeeScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        scoring_type: ScoringType.COMMITTEE,
      },
    });

    if (committeeScores.length === 0) {
      throw new NotFoundException('Đề tài chưa có phiếu chấm hội đồng');
    }

    const own = teacherId
      ? committeeScores.find((s) => s.teacher_id === teacherId)
      : undefined;

    if (!staff && !own) {
      throw new ForbiddenException('Bạn không thuộc hội đồng của đề tài này');
    }

    const canEditAll =
      staff ||
      own?.role === CommitteeRole.CHAIRMAN ||
      own?.role === CommitteeRole.SECRETARY;
    const canFinalize = canEditAll;

    return { staff, teacherId, own, canEditAll, canFinalize };
  }

  // ============ EXPORT SCORE SHEET ============

  async exportScoreSheetWord(scoreId: number, userId: number): Promise<Buffer> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { user_id: userId },
    });

    if (!teacher) {
      throw new ForbiddenException('Chỉ giảng viên mới được xuất phiếu chấm');
    }

    const score = await this.prisma.independent_scores.findUnique({
      where: { id: scoreId },
      include: {
        projects: true,
        students: true,
        teachers: true,
      },
    });

    if (!score) {
      throw new NotFoundException('Phiếu chấm không tồn tại');
    }

    if (score.teacher_id !== teacher.id) {
      throw new ForbiddenException('Bạn không có quyền xuất phiếu chấm này');
    }

    // Read the template
    const templatePath = path.join(
      process.cwd(),
      'src',
      'templates',
      'score_sheet_template.docx',
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        'Không tìm thấy file mẫu score_sheet_template.docx trong thư mục src/templates.',
      );
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render the document
    doc.render({
      student_name: `${score.students.first_name} ${score.students.middle_name} ${score.students.last_name}`,
      student_mssv: score.students.student_id,
      project_code: score.projects.project_id,
      project_name: score.projects.project_name,
      teacher_name: score.teachers.name,
      scoring_type:
        score.scoring_type === ScoringType.GVHD
          ? 'Giảng viên hướng dẫn'
          : 'Hội đồng bảo vệ',
      total_score: score.score || 0,
      strengths: score.strengths || '',
      weaknesses: score.weaknesses || '',
      notes: score.notes || '',
    });

    return doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  }
}
