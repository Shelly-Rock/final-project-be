import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { Prisma, ScoringType, ScoringStatus, CommitteeRole } from '@prisma/client';
import { CreateIndependentScoreDto, UpdateScoreDto, SubmitScoreDto, QueryScoresDto, QueryMyScoresDto } from './scoring.dto';

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ SCORE MANAGEMENT ============

  async createScore(dto: CreateIndependentScoreDto) {
    const { projectId, studentId, teacherId, scoringType, role } = dto;

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (scoringType === ScoringType.GVHD ? 7 : 3));

    const existing = await this.prisma.independent_scores.findFirst({
      where: {
        project_id: projectId,
        teacher_id: teacherId,
        scoring_type: scoringType,
      },
    });

    if (existing) {
      throw new BadRequestException('Score record already exists for this project and teacher');
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

    // Tra teacher_id từ user_id
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId },
    });

    // Nếu userId = 0 (truyền cứng từ Admin ở Controller updateScore admin) thì bypass kiểm tra
    if (userId !== 0 && (!teacher || score.teacher_id !== teacher.id)) {
      throw new ForbiddenException('You are not authorized to update this score');
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
        criteria_scores: dto.criteriaScores as Prisma.JsonValue,
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

    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId },
    });

    if (!teacher || score.teacher_id !== teacher.id) {
      throw new ForbiddenException('You are not authorized to submit this score');
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
          status: ScoringStatus.SUBMITTED,
        },
      });

      // Calculate average defense score
      if (committeeScores.length > 0) {
        const totalScore = committeeScores.reduce((sum, s) => sum + (s.score || 0), 0);
        updateData.defense_score = totalScore / committeeScores.length;
      }

      // Count passed/failed
      const failedCount = committeeScores.filter((s) => (s.score || 0) < 4).length;

      // If any committee member scored < 4, mark as not passed
      if (failedCount > 0) {
        updateData.is_final_passed = false;
        updateData.final_status = 'REJECTED_DEFENSE';
      } else if (committeeScores.length >= 3) {
        // Minimum 3 committee members for final approval
        updateData.is_final_passed = true;
        updateData.final_status = 'PASSED';
      }
    }

    // Calculate final score if both GVHD and defense scores are available
    const allScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        status: ScoringStatus.SUBMITTED,
      },
    });

    const gvhdScore = allScores.find((s) => s.scoring_type === ScoringType.GVHD);
    const allCommitteeScores = allScores.filter((s) => s.scoring_type === ScoringType.COMMITTEE);

    if (gvhdScore && gvhdScore.score !== null && allCommitteeScores.length > 0) {
      const avgCommittee = allCommitteeScores.reduce((sum, s) => sum + (s.score || 0), 0) / allCommitteeScores.length;
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
    const { page = 1, limit = 20, status, scoringType } = query;
    const skip = (page - 1) * limit;

    // Tra teacher_id thực từ user_id (tránh nhầm lẫn user_id với teacher_id)
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId },
    });
    if (!teacher) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const where: Prisma.independent_scoresWhereInput = {
      teacher_id: teacher.id,
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
    const { page = 1, limit = 20, scoringType, status, teacherId, projectId, studentId } = query;
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
    // Tra teacher_id thực từ user_id
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId },
    });
    if (!teacher) {
      return { total: 0, pending: 0, submitted: 0, failed: 0, passed: 0 };
    }

    const scores = await this.prisma.independent_scores.findMany({
      where: { teacher_id: teacher.id },
    });

    return {
      total: scores.length,
      pending: scores.filter((s) => s.status === ScoringStatus.PENDING || s.status === ScoringStatus.IN_PROGRESS).length,
      submitted: scores.filter((s) => s.status === ScoringStatus.SUBMITTED).length,
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
    const sessionProject = await this.prisma.defense_session_projects.findUnique({
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
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'score_sheet_template.docx');
    
    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException('Không tìm thấy file mẫu score_sheet_template.docx trong thư mục src/templates.');
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
      scoring_type: score.scoring_type === ScoringType.GVHD ? 'Giảng viên hướng dẫn' : 'Hội đồng bảo vệ',
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
