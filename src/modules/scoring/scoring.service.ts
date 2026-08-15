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
        projectId,
        teacherId,
        scoringType,
      },
    });

    if (existing) {
      throw new BadRequestException('Score record already exists for this project and teacher');
    }

    return this.prisma.independentScore.create({
      data: {
        projectId,
        studentId,
        teacherId,
        scoringType,
        role: role || null,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
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

    if (score.teacherId !== teacherId) {
      throw new ForbiddenException('You are not authorized to update this score');
    }

    if (score.status === ScoringStatus.SUBMITTED) {
      throw new BadRequestException('Cannot update a submitted score');
    }

    return this.prisma.independentScore.update({
      where: { id },
      data: {
        ...dto,
        criteriaScores: dto.criteriaScores as Prisma.JsonValue,
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

    if (score.teacherId !== teacherId) {
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
        maxScore: dto.maxScore || 10,
        criteriaScores: dto.criteriaScores as Prisma.JsonValue,
        notes: dto.notes,
        strengths: dto.strengths,
        weaknesses: dto.weaknesses,
        status: isFailed ? ScoringStatus.FAILED : ScoringStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    // Update scoring result
    await this.updateScoringResult(score.projectId, score.scoringType, dto.score);

    return updatedScore;
  }

  async updateScoringResult(projectId: number, scoringType: ScoringType, score: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;

    let result = await this.prisma.scoringResult.findUnique({
      where: { projectId },
    });

    if (!result) {
      result = await this.prisma.scoringResult.create({
        data: {
          projectId,
          studentId: project.studentId,
        },
      });
    }

    const isPassed = score >= 4;
    const updateData: Prisma.ScoringResultUpdateInput = {};

    if (scoringType === ScoringType.GVHD) {
      updateData.gvhdScore = score;
      updateData.isGvhdFailed = !isPassed;
      updateData.gvhdPassed = isPassed;

      if (!isPassed) {
        updateData.isEliminated = true;
        updateData.finalStatus = 'ELIMINATED_GVHD';
      }
    } else {
      // Committee score - update committee scores array
      const committeeScores = (result.committeeScores as any[]) || [];
      const existingIndex = committeeScores.findIndex(s => s.teacherId === project.teacherId);
      
      if (existingIndex >= 0) {
        committeeScores[existingIndex] = {
          ...committeeScores[existingIndex],
          score,
          passed: isPassed,
        };
      } else {
        committeeScores.push({
          teacherId: project.teacherId,
          score,
          passed: isPassed,
        });
      }

      updateData.committeeScores = committeeScores as Prisma.JsonValue;
      updateData.totalCommitteeScores = committeeScores.length;
      
      // Count failed scores
      const failedCount = committeeScores.filter(s => !s.passed).length;
      updateData.failedCount = failedCount;

      // If any committee member scored < 4, eliminate
      if (!isPassed) {
        updateData.isEliminated = true;
        updateData.finalStatus = 'ELIMINATED_COMMITTEE';
      }
    }

    // If not eliminated yet, check if all scores are in
    if (!result.isEliminated) {
      const allScores = await this.prisma.independentScore.findMany({
        where: {
          projectId,
          status: ScoringStatus.SUBMITTED,
        },
      });

      if (allScores.length === 5) { // 1 GVHD + 4 committee members
        updateData.finalStatus = 'APPROVED';
      }
    }

    return this.prisma.scoringResult.update({
      where: { projectId },
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
            projectId: true,
            projectName: true,
          },
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            className: true,
          },
        },
        teacher: {
          select: {
            teacherId: true,
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
      teacherId,
    };

    if (status) {
      where.status = status;
    }

    if (scoringType) {
      where.scoringType = scoringType;
    }

    const [scores, total] = await Promise.all([
      this.prisma.independentScore.findMany({
        where,
        include: {
          project: {
            select: {
              projectId: true,
              projectName: true,
            },
          },
          student: {
            select: {
              studentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              className: true,
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
      where: { projectId },
      include: {
        teacher: {
          select: {
            teacherId: true,
            name: true,
          },
        },
      },
      orderBy: { scoringType: 'asc' },
    });
  }

  async getScores(query: QueryScoresDto) {
    const { page = 1, limit = 20, scoringType, status, teacherId, projectId, studentId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.IndependentScoreWhereInput = {};

    if (scoringType) where.scoringType = scoringType;
    if (status) where.status = status;
    if (teacherId) where.teacherId = teacherId;
    if (projectId) where.projectId = projectId;
    if (studentId) where.studentId = studentId;

    const [scores, total] = await Promise.all([
      this.prisma.independentScore.findMany({
        where,
        include: {
          project: {
            select: {
              projectId: true,
              projectName: true,
            },
          },
          student: {
            select: {
              studentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              className: true,
            },
          },
          teacher: {
            select: {
              teacherId: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      where: { teacherId },
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
      where: { projectId },
    });

    if (!result) {
      return null;
    }

    // Get individual scores for detailed view
    const scores = await this.prisma.independentScore.findMany({
      where: { projectId },
      include: {
        teacher: {
          select: {
            teacherId: true,
            name: true,
          },
        },
      },
    });

    const committeeScores = scores
      .filter(s => s.scoringType === ScoringType.COMMITTEE)
      .map(s => ({
        role: s.role,
        teacherId: s.teacherId,
        teacherName: s.teacher.name,
        score: s.score,
        passed: s.score !== null && s.score >= 4,
      }));

    const gvhdScore = scores.find(s => s.scoringType === ScoringType.GVHD);

    return {
      id: result.id,
      projectId: result.projectId,
      studentId: result.studentId,
      gvhdScore: gvhdScore?.score || null,
      gvhdPassed: result.gvhdPassed,
      committeeScores,
      totalCommitteeScores: result.totalCommitteeScores,
      failedCount: result.failedCount,
      isEliminated: result.isEliminated,
      isGvhdFailed: result.isGvhdFailed,
      finalStatus: result.finalStatus,
      scoreSheetUrl: result.scoreSheetUrl,
    };
  }

  async getAllScoringResults(query: QueryScoresDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const results = await this.prisma.scoringResult.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.scoringResult.count();

    // Enrich with project info
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const project = await this.prisma.project.findUnique({
          where: { id: result.projectId },
          select: {
            projectId: true,
            projectName: true,
          },
        });

        const student = await this.prisma.student.findUnique({
          where: { id: result.studentId },
          select: {
            studentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
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
        projectId: sessionProject.projectId,
        studentId: sessionProject.project.studentId,
        teacherId: committee.chairman.id,
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.CHAIRMAN,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
      });
    }

    // Add secretary
    if (committee.secretary) {
      scoresToCreate.push({
        projectId: sessionProject.projectId,
        studentId: sessionProject.project.studentId,
        teacherId: committee.secretary.id,
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.SECRETARY,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
      });
    }

    // Add internal reviewers
    if (committee.internal_1) {
      scoresToCreate.push({
        projectId: sessionProject.projectId,
        studentId: sessionProject.project.studentId,
        teacherId: committee.internal_1.id,
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.INTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
      });
    }

    if (committee.internal_2) {
      scoresToCreate.push({
        projectId: sessionProject.projectId,
        studentId: sessionProject.project.studentId,
        teacherId: committee.internal_2.id,
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.INTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
      });
    }

    // Add external reviewers
    for (const reviewer of committee.external_reviewers) {
      scoresToCreate.push({
        projectId: sessionProject.projectId,
        studentId: sessionProject.project.studentId,
        teacherId: reviewer.teacherId,
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.EXTERNAL_REVIEWER,
        deadline,
        status: ScoringStatus.PENDING,
        maxScore: 10,
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
