import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { Prisma, ScoringType, ScoringStatus, CommitteeRole } from '@prisma/client';
import { CreateIndependentScoreDto, UpdateScoreDto, SubmitScoreDto, QueryScoresDto, QueryMyScoresDto } from './scoring.dto';

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ SCORE MANAGEMENT ============

  async createScore(dto: CreateIndependentScoreDto) {
    const { projectId, studentId, teacherId, scoringType, role } = dto;

    // Calculate deadline based on scoring type
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (scoringType === ScoringType.GVHD ? 7 : 3));

    // Check if score already exists
    const existing = await this.prisma.independentScore.findFirst({
      where: {
        project_id: projectId,
        teacher_id: teacherId,
        scoring_type: scoringType,
      },
    });

    if (existing) {
      throw new BadRequestException('Score record already exists for this project and teacher');
    }

    return this.prisma.independentScore.create({
      data: {
        project_id: projectId,
        student_id: studentId,
        teacher_id: teacherId,
        scoring_type: scoringType,
        role: role || null,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      },
    });
  }

  async updateScore(id: number, teacherId: number, dto: UpdateScoreDto) {
    const score = await this.prisma.independentScore.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    if (score.teacher_id !== teacherId) {
      throw new ForbiddenException('You are not authorized to update this score');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Cannot update a submitted score');
    }

    return this.prisma.independentScore.update({
      where: { id },
      data: {
        score: dto.score,
        max_score: dto.maxScore,
        criteria_scores: dto.criteriaScores as Prisma.JsonValue,
        status: dto.status,
        notes: dto.notes,
        strengths: dto.strengths,
        weaknesses: dto.weaknesses,
      },
    });
  }

  async submitScore(id: number, teacherId: number, dto: SubmitScoreDto) {
    const score = await this.prisma.independentScore.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    if (score.teacher_id !== teacherId) {
      throw new ForbiddenException('You are not authorized to submit this score');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Score already submitted');
    }

    const isFailed = dto.score < 4;

    // Update score
    const updatedScore = await this.prisma.independentScore.update({
      where: { id },
      data: {
        score: dto.score,
        max_score: dto.maxScore || 10,
        criteria_scores: dto.criteriaScores as Prisma.JsonValue,
        notes: dto.notes,
        strengths: dto.strengths,
        weaknesses: dto.weaknesses,
        status: isFailed ? ScoringStatus.FAILED : ScoringStatus.SUBMITTED,
        submitted_at: new Date(),
      },
    });

    // Update scoring result
    await this.updateScoringResult(score.project_id, score.scoring_type, dto.score);

    return updatedScore;
  }

  async updateScoringResult(projectId: number, scoringType: ScoringType, score: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;

    let result = await this.prisma.scoringResult.findUnique({
      where: { project_id: projectId },
    });

    if (!result) {
      result = await this.prisma.scoringResult.create({
        data: {
          project_id: projectId,
          student_id: project.student_id,
        },
      });
    }

    const isPassed = score >= 4;
    const updateData: Prisma.ScoringResultUpdateInput = {};

    if (scoringType === ScoringType.GVHD) {
      updateData.gvhd_score = score;
      updateData.is_gvhd_failed = !isPassed;
      updateData.gvhd_passed = isPassed;

      if (!isPassed) {
        updateData.is_eliminated = true;
        updateData.final_status = 'ELIMINATED_GVHD';
      }
    } else {
      // Committee score - update committee scores array
      const committeeScores = (result.committee_scores as any[]) || [];
      const existingIndex = committeeScores.findIndex(s => s.teacherId === project.teacher_id);
      
      if (existingIndex >= 0) {
        committeeScores[existingIndex] = {
          ...committeeScores[existingIndex],
          score,
          passed: isPassed,
        };
      } else {
        committeeScores.push({
          teacherId: project.teacher_id,
          score,
          passed: isPassed,
        });
      }

      updateData.committee_scores = committeeScores as Prisma.JsonValue;
      updateData.total_committee_scores = committeeScores.length;
      
      // Count failed scores
      const failedCount = committeeScores.filter(s => !s.passed).length;
      updateData.failed_count = failedCount;

      // If any committee member scored < 4, eliminate
      if (!isPassed) {
        updateData.is_eliminated = true;
        updateData.final_status = 'ELIMINATED_COMMITTEE';
      }
    }

    // If not eliminated yet, check if all scores are in
    if (!result.is_eliminated) {
      const allScores = await this.prisma.independentScore.findMany({
        where: {
          project_id: projectId,
          status: ScoringStatus.SUBMITTED,
        },
      });

      if (allScores.length === 5) { // 1 GVHD + 4 committee members
        updateData.final_status = 'APPROVED';
      }
    }

    return this.prisma.scoringResult.update({
      where: { project_id: projectId },
      data: updateData,
    });
  }

  // ============ QUERIES ============

  async getScoreById(id: number) {
    const score = await this.prisma.independentScore.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            project_id: true,
            project_name: true,
          },
        },
        student: {
          select: {
            student_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            class_name: true,
          },
        },
        teacher: {
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

  async getMyScores(teacherId: number, query: QueryMyScoresDto) {
    const { page = 1, limit = 20, status, scoringType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.IndependentScoreWhereInput = {
      teacher_id: teacherId,
    };

    if (status) {
      where.status = status;
    }

    if (scoringType) {
      where.scoring_type = scoringType;
    }

    const [scores, total] = await Promise.all([
      this.prisma.independentScore.findMany({
        where,
        include: {
          project: {
            select: {
              project_id: true,
              project_name: true,
            },
          },
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
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.independentScore.count({ where }),
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

  async getScoresByProject(projectId: number) {
    return this.prisma.independentScore.findMany({
      where: { project_id: projectId },
      include: {
        teacher: {
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
    const { page = 1, limit = 20, scoringType, status, teacherId, projectId, studentId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.IndependentScoreWhereInput = {};

    if (scoringType) where.scoring_type = scoringType;
    if (status) where.status = status;
    if (teacherId) where.teacher_id = teacherId;
    if (projectId) where.project_id = projectId;
    if (studentId) where.student_id = studentId;

    const [scores, total] = await Promise.all([
      this.prisma.independentScore.findMany({
        where,
        include: {
          project: {
            select: {
              project_id: true,
              project_name: true,
            },
          },
          student: {
            select: {
              student_id: true,
              first_name: true,
              middle_name: true,
              last_name: true,
              class_name: true,
            },
          },
          teacher: {
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
      this.prisma.independentScore.count({ where }),
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

  async getMyStats(teacherId: number) {
    const scores = await this.prisma.independentScore.findMany({
      where: { teacher_id: teacherId },
    });

    return {
      total: scores.length,
      pending: scores.filter(s => s.status === ScoringStatus.PENDING || s.status === ScoringStatus.IN_PROGRESS).length,
      submitted: scores.filter(s => s.status === ScoringStatus.SUBMITTED).length,
      failed: scores.filter(s => s.status === ScoringStatus.FAILED).length,
      passed: scores.filter(s => s.status === ScoringStatus.PASSED).length,
    };
  }

  // ============ SCORING RESULTS ============

  async getScoringResult(projectId: number) {
    const result = await this.prisma.scoringResult.findUnique({
      where: { project_id: projectId },
    });

    if (!result) {
      return null;
    }

    // Get individual scores for detailed view
    const scores = await this.prisma.independentScore.findMany({
      where: { project_id: projectId },
      include: {
        teacher: {
          select: {
            teacher_id: true,
            name: true,
          },
        },
      },
    });

    const committeeScoresList = scores
      .filter(s => s.scoring_type === ScoringType.COMMITTEE)
      .map(s => ({
        role: s.role,
        teacherId: s.teacher_id,
        teacherName: s.teacher.name,
        score: s.score,
        passed: s.score !== null && s.score >= 4,
      }));

    const gvhdScore = scores.find(s => s.scoring_type === ScoringType.GVHD);

    return {
      id: result.id,
      projectId: result.project_id,
      studentId: result.student_id,
      gvhdScore: gvhdScore?.score || null,
      gvhdPassed: result.gvhd_passed,
      committeeScores: committeeScoresList,
      totalCommitteeScores: result.total_committee_scores,
      failedCount: result.failed_count,
      isEliminated: result.is_eliminated,
      isGvhdFailed: result.is_gvhd_failed,
      finalStatus: result.final_status,
      scoreSheetUrl: result.score_sheet_url,
    };
  }

  async getAllScoringResults(query: QueryScoresDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const results = await this.prisma.scoringResult.findMany({
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.scoringResult.count();

    // Enrich with project info
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
      })
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
    // Get session project
    const sessionProject = await this.prisma.defenseSessionProject.findUnique({
      where: { id: sessionProjectId },
      include: {
        project: true,
      },
    });

    if (!sessionProject) {
      throw new NotFoundException('Session project not found');
    }

    // Get committee members
    const committee = await this.prisma.defenseCommittee.findUnique({
      where: { id: committeeId },
      include: {
        chairman: true,
        secretary: true,
        internal_1: true,
        internal_2: true,
        external_reviewers: {
          include: {
            teacher: true,
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

    // Add chairman
    if (committee.chairman) {
      scoresToCreate.push({
        project_id: sessionProject.project_id,
        student_id: sessionProject.project.student_id,
        teacher_id: committee.chairman.id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.CHAIRMAN,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Add secretary
    if (committee.secretary) {
      scoresToCreate.push({
        project_id: sessionProject.project_id,
        student_id: sessionProject.project.student_id,
        teacher_id: committee.secretary.id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.SECRETARY,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Add internal reviewers
    if (committee.internal_1) {
      scoresToCreate.push({
        project_id: sessionProject.project_id,
        student_id: sessionProject.project.student_id,
        teacher_id: committee.internal_1.id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.INTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    if (committee.internal_2) {
      scoresToCreate.push({
        project_id: sessionProject.project_id,
        student_id: sessionProject.project.student_id,
        teacher_id: committee.internal_2.id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.INTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Add external reviewers
    for (const reviewer of committee.external_reviewers) {
      scoresToCreate.push({
        project_id: sessionProject.project_id,
        student_id: sessionProject.project.student_id,
        teacher_id: reviewer.teacher_id,
        scoring_type: ScoringType.COMMITTEE,
        role: CommitteeRole.EXTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        max_score: 10,
      });
    }

    // Create all scores
    return this.prisma.independentScore.createMany({
      data: scoresToCreate,
      skipDuplicates: true,
    });
  }

  // ============ DELETE ============

  async deleteScore(id: number) {
    const score = await this.prisma.independentScore.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Cannot delete a submitted score');
    }

    return this.prisma.independentScore.delete({
      where: { id },
    });
  }
}
