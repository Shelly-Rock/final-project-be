import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import {
  RUBRIC_GVHD,
  RUBRIC_GVPB,
  RUBRIC_COMMITTEE,
} from './rubrics.constant';
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
  QueryTranscriptsDto,
  UpdateBonusScoreDto,
  QueryPostDefenseDto,
  SetRevisionWindowDto,
  SubmitRevisionDto,
  UpdateRankDto,
  QueryScoreIssuanceDto,
} from './scoring.dto';


function scoreToText(score: number): string {
    if (score === null || score === undefined) return '';
    const num = Math.round(score * 100) / 100;
    if (num === 10) return 'Mười';
    if (num === 0) return 'Không';
    
    const units = ['Không', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín'];
    const parts = num.toString().split('.');
    let text = units[parseInt(parts[0])];
    
    if (parts.length > 1) {
        text += ' phẩy';
        const decimals = parts[1];
        for (let i = 0; i < decimals.length; i++) {
            const digit = parseInt(decimals[i]);
            if (decimals.length === 2 && i === 1 && digit === 5 && parseInt(decimals[0]) !== 0) {
               text += ' lăm';
            } else {
               text += ' ' + units[digit].toLowerCase();
            }
        }
    }
    
    return text;
}

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  private buildScoreSheetRecipients(project: any) {
    const sessionProject = project.defense_session_projects?.[0];
    const committee = sessionProject?.defense_sessions?.defense_committees;
    if (!committee) return { recipients: [], reason: 'Chưa được xếp lịch bảo vệ.' };

    const members = committee.committee_members ?? [];
    const chairmen = members.filter(
      (member: any) => member.role === CommitteeRole.CHAIRMAN,
    );
    const secretaries = members.filter(
      (member: any) => member.role === CommitteeRole.SECRETARY,
    );
    const internals = members.filter(
      (member: any) => member.role === CommitteeRole.INTERNAL_REVIEWER,
    );
    const chairman = chairmen[0];
    const secretary = secretaries[0];
    const internal = internals[0];
    const external = committee.committee_external_reviewers ?? [];

    if (
      chairmen.length !== 1 ||
      secretaries.length !== 1 ||
      internals.length !== 1 ||
      external.length !== 1
    ) {
      return {
        recipients: [],
        reason:
          'Hội đồng phải có đúng Chủ tịch, Thư ký, một Phản biện trong và một Phản biện ngoài.',
      };
    }

    return {
      recipients: [
        {
          teacherId: project.teacher_id,
          scoringType: ScoringType.GVHD,
          role: null,
          label: 'GVHD',
          teacherName: project.teacher.name,
        },
        {
          teacherId: external[0].teacher_id,
          scoringType: ScoringType.COMMITTEE,
          role: CommitteeRole.EXTERNAL_REVIEWER,
          label: 'GVPB ngoài',
          teacherName: external[0].teachers.name,
        },
        {
          teacherId: chairman.teacher_id,
          scoringType: ScoringType.COMMITTEE,
          role: CommitteeRole.CHAIRMAN,
          label: 'Chủ tịch hội đồng',
          teacherName: chairman.teachers.name,
        },
        {
          teacherId: secretary.teacher_id,
          scoringType: ScoringType.COMMITTEE,
          role: CommitteeRole.SECRETARY,
          label: 'Thư ký hội đồng',
          teacherName: secretary.teachers.name,
        },
        {
          teacherId: internal.teacher_id,
          scoringType: ScoringType.COMMITTEE,
          role: CommitteeRole.INTERNAL_REVIEWER,
          label: 'Phản biện trong',
          teacherName: internal.teachers.name,
        },
      ],
      reason: null,
    };
  }

  async getScoreIssuanceCandidates(query: QueryScoreIssuanceDto) {
    const { page = 1, limit = 20, facultyId } = query;
    const projects = await this.prisma.project.findMany({
      where: {
        status: 'APPROVED',
        deleted_at: null,
        ...(facultyId ? { teacher: { faculty_id: facultyId } } : {}),
      },
      include: {
        student: {
          select: { student_id: true, first_name: true, middle_name: true, last_name: true },
        },
        teacher: { select: { id: true, teacher_id: true, name: true } },
        topics: { include: { final_submissions: true } },
        independent_scores: {
          where: { deleted_at: null },
          select: { teacher_id: true, scoring_type: true, role: true, status: true, deadline: true },
        },
        defense_session_projects: {
          where: { defense_sessions: { deleted_at: null, status: 'SCHEDULED' } },
          include: {
            defense_sessions: {
              include: {
                defense_committees: {
                  include: {
                    committee_members: { include: { teachers: { select: { name: true } } } },
                    committee_external_reviewers: { include: { teachers: { select: { name: true } } } },
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    const rows = projects.map((project: any) => {
      const submissionApproved = project.topics?.final_submissions?.status === 'APPROVED';
      const { recipients, reason: committeeReason } = this.buildScoreSheetRecipients(project);
      const existing = project.independent_scores ?? [];
      const sheets = recipients.map((recipient: any) => {
        const issued = existing.find(
          (score: any) =>
            score.teacher_id === recipient.teacherId &&
            score.scoring_type === recipient.scoringType,
        );
        return { ...recipient, issued: Boolean(issued), status: issued?.status ?? null, deadline: issued?.deadline ?? null };
      });
      const reason = !submissionApproved
        ? 'Bài nộp cuối kỳ chưa được thư ký duyệt.'
        : committeeReason;
      return {
        projectId: project.id,
        projectCode: project.topics?.code ?? project.project_id,
        projectName: project.topics?.name ?? project.project_name,
        student: {
          studentId: project.student.student_id,
          name: [project.student.last_name, project.student.middle_name, project.student.first_name]
            .filter(Boolean)
            .join(' '),
        },
        supervisor: { id: project.teacher.id, code: project.teacher.teacher_id, name: project.teacher.name },
        finalSubmissionStatus: project.topics?.final_submissions?.status ?? null,
        committeeName: project.defense_session_projects?.[0]?.defense_sessions?.defense_committees?.name ?? null,
        eligible: submissionApproved && !committeeReason,
        reason,
        sheets,
        issuedCount: sheets.filter((sheet: any) => sheet.issued).length,
        requiredCount: recipients.length,
      };
    });

    const start = (page - 1) * limit;
    return {
      data: rows.slice(start, start + limit),
      meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
    };
  }

  async issueScoreSheets(userId: number, projectIds: number[], deadline: Date) {
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      throw new BadRequestException('Hạn chấm phải là thời điểm trong tương lai.');
    }
    const candidates = await this.getScoreIssuanceCandidates({ page: 1, limit: 10_000 });
    const byProjectId = new Map(candidates.data.map((candidate: any) => [candidate.projectId, candidate]));
    const requestedIds = [...new Set(projectIds)];

    for (const projectId of requestedIds) {
      const candidate = byProjectId.get(projectId);
      if (!candidate) throw new NotFoundException(`Không tìm thấy project ${projectId}.`);
      if (!candidate.eligible) throw new BadRequestException(candidate.reason);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const projectId of requestedIds) {
        const candidate = byProjectId.get(projectId);
        for (const sheet of candidate.sheets) {
          if (sheet.issued) continue;
          await tx.independent_scores.create({
            data: {
              project_id: projectId,
              student_id: (await tx.project.findUnique({ where: { id: projectId }, select: { student_id: true } }))!.student_id,
              teacher_id: sheet.teacherId,
              scoring_type: sheet.scoringType,
              role: sheet.role,
              deadline,
              status: ScoringStatus.PENDING,
              max_score: 10,
              updated_at: new Date(),
            },
          });
          count++;
        }
      }
      return count;
    });

    return { projectIds: requestedIds, issuedCount: created, issuedByUserId: userId };
  }

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

    await this.assertScoreStageUnlocked(score);

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

    await this.assertScoreStageUnlocked(score);

    if (score.scoring_type === ScoringType.COMMITTEE) {
      const result = await this.prisma.scoring_results.findUnique({
        where: { project_id: score.project_id },
      });
      if (result?.final_status === 'REJECTED_GVHD') {
        throw new ForbiddenException(
          'Đề tài đã không đạt vòng GVHD nên không thể tiếp tục chấm hội đồng.',
        );
      }
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
      score.role,
    );

    return updatedScore;
  }

  private getScoreStageLockReason(
    score: {
      scoring_type: ScoringType;
      role: CommitteeRole | null;
      status: ScoringStatus;
    },
    relatedScores: {
      scoring_type: ScoringType;
      role: CommitteeRole | null;
      score: number | null;
      status: ScoringStatus;
    }[],
    result?: { final_status?: string | null } | null,
  ) {
    const completedStatuses: ScoringStatus[] = [
      ScoringStatus.SUBMITTED,
      ScoringStatus.PASSED,
      ScoringStatus.FAILED,
    ];
    if (
      score.scoring_type === ScoringType.COMMITTEE &&
      result?.final_status === 'REJECTED_GVHD'
    ) {
      return 'Không đạt vòng GVHD; phiếu chấm các giai đoạn sau đã khóa.';
    }
    if (score.scoring_type === ScoringType.COMMITTEE && this.isFinalized(result)) {
      return 'Điểm hội đồng đã được chốt.';
    }
    if (
      score.scoring_type !== ScoringType.COMMITTEE ||
      ([ScoringStatus.SUBMITTED, ScoringStatus.PASSED] as ScoringStatus[]).includes(
        score.status,
      )
    ) {
      return null;
    }
    if (result?.final_status === 'REJECTED_GVHD') {
      return 'Không đạt vòng GVHD; phiếu chấm các giai đoạn sau đã khóa.';
    }

    const gvhd = relatedScores.find(
      (row) => row.scoring_type === ScoringType.GVHD,
    );
    if (!gvhd || gvhd.score === null || !completedStatuses.includes(gvhd.status)) {
      return 'Đang chờ giảng viên hướng dẫn nộp phiếu.';
    }
    if (gvhd.score < 4) {
      return 'Không đạt vòng GVHD; phiếu chấm các giai đoạn sau đã khóa.';
    }
    if (score.role === CommitteeRole.EXTERNAL_REVIEWER) return null;

    const external = relatedScores.find(
      (row) =>
        row.scoring_type === ScoringType.COMMITTEE &&
        row.role === CommitteeRole.EXTERNAL_REVIEWER,
    );
    if (
      !external ||
      external.score === null ||
      !completedStatuses.includes(external.status)
    ) {
      return 'Đang chờ giảng viên phản biện ngoài nộp phiếu.';
    }
    return null;
  }

  private async assertScoreStageUnlocked(score: {
    project_id: number;
    scoring_type: ScoringType;
    role: CommitteeRole | null;
    status: ScoringStatus;
  }) {
    if (score.scoring_type !== ScoringType.COMMITTEE) return;
    const [relatedScores, result] = await Promise.all([
      this.prisma.independent_scores.findMany({
        where: { project_id: score.project_id, deleted_at: null },
        select: { scoring_type: true, role: true, score: true, status: true },
      }),
      this.prisma.scoring_results.findUnique({
        where: { project_id: score.project_id },
        select: { final_status: true },
      }),
    ]);
    const reason = this.getScoreStageLockReason(score, relatedScores, result);
    if (reason) throw new ForbiddenException(reason);
  }

  async updateScoringResult(
    projectId: number,
    scoringType: ScoringType,
    score: number,
    role?: string | null,
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
      if (role === 'EXTERNAL_REVIEWER') {
        updateData.review_score = score;
      }
      
      // Defense score is the average of the three internal committee members.
      const committeeScores = await this.prisma.independent_scores.findMany({
        where: {
          project_id: projectId,
          scoring_type: ScoringType.COMMITTEE,
          role: { not: CommitteeRole.EXTERNAL_REVIEWER },
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

      // Calculate the internal committee average.
      if (committeeScores.length > 0) {
        const totalScore = committeeScores.reduce(
          (sum, s) => sum + (s.score || 0),
          0,
        );
        updateData.defense_score = totalScore / committeeScores.length;
      }
    }

    // Keep the stored preview aligned with the transcript formula.
    const allScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
        status: {
          in: [
            ScoringStatus.SUBMITTED,
            ScoringStatus.FAILED,
            ScoringStatus.PASSED,
          ],
        },
      },
    });

    const gvhdScores = allScores.filter(
      (s) => s.scoring_type === ScoringType.GVHD,
    );
    const committeeScores = allScores.filter(
      (s) => s.scoring_type === ScoringType.COMMITTEE,
    );
    const gvhdScore = gvhdScores[0];
    const externalScore = committeeScores.find(
      (s) => s.role === CommitteeRole.EXTERNAL_REVIEWER,
    );
    const internalScores = committeeScores.filter((s) =>
      ([
        CommitteeRole.CHAIRMAN,
        CommitteeRole.SECRETARY,
        CommitteeRole.INTERNAL_REVIEWER,
      ] as CommitteeRole[]).includes(s.role as CommitteeRole),
    );
    const internalRolesComplete = ([
      CommitteeRole.CHAIRMAN,
      CommitteeRole.SECRETARY,
      CommitteeRole.INTERNAL_REVIEWER,
    ] as CommitteeRole[]).every(
      (memberRole) =>
        internalScores.filter((score) => score.role === memberRole).length === 1,
    );
    if (
      gvhdScores.length === 1 &&
      gvhdScore?.score !== null &&
      gvhdScore?.score !== undefined &&
      externalScore?.score !== null &&
      externalScore?.score !== undefined &&
      internalScores.length === 3 &&
      internalRolesComplete &&
      committeeScores.length === 4
    ) {
      const internalAverage =
        internalScores.reduce((sum, s) => sum + (s.score ?? 0), 0) / 3;
      updateData.final_score = Math.min(
        10,
        Math.round(
          (gvhdScore.score * 0.4 + externalScore.score * 0.2 + internalAverage * 0.4) * 100,
        ) / 100,
      );
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
              scoring_results: {
                select: { gvhd_score: true, review_score: true, final_status: true },
              },
              independent_scores: {
                where: { deleted_at: null },
                select: {
                  scoring_type: true,
                  role: true,
                  score: true,
                  status: true,
                },
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
        skip,
        take: limit,
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.independent_scores.count({ where }),
    ]);

    return {
      data: scores.map((s) => {
        let isLocked = false;
        let lockedReason = null;
        const result = (s as any).projects?.scoring_results;
        
        if (
          s.scoring_type === ScoringType.COMMITTEE &&
          result?.final_status === 'REJECTED_GVHD'
        ) {
          isLocked = true;
          lockedReason = 'Đề tài không đạt vòng GVHD.';
        }

        const stageLockReason = this.getScoreStageLockReason(
          s,
          (s as any).projects?.independent_scores ?? [],
          result,
        );
        if (stageLockReason) {
          isLocked = true;
          lockedReason = stageLockReason;
        }

        return {
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
          isLocked,
          lockedReason,
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
      };
      }),
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
      facultyId,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.independent_scoresWhereInput = {};

    if (scoringType) where.scoring_type = scoringType;
    if (status) where.status = status;
    if (teacherId) where.teacher_id = teacherId;
    if (projectId) where.project_id = projectId;
    if (studentId) where.student_id = studentId;
    if (facultyId) {
      where.projects = { teacher: { faculty_id: facultyId } };
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
    const { page = 1, limit = 20, facultyId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.scoring_resultsWhereInput = facultyId
      ? { projects: { teacher: { faculty_id: facultyId } } }
      : {};

    const results = await this.prisma.scoring_results.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    const total = await this.prisma.scoring_results.count({ where });

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

  // ============ EXPORT SUMMARY SCORE SHEET ============
  
  async exportSummaryScoreSheetWord(
    projectId: number,
    userId: number,
    role: string,
  ): Promise<Buffer> {
    await this.assertTranscriptFacultyAccess(projectId, userId, role);
    const transcript = await this.buildTranscript(projectId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        student: true,
        topics: { select: { code: true, name: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const committeeScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        scoring_type: ScoringType.COMMITTEE,
        role: { in: [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] },
        deleted_at: null,
      },
      include: { teachers: true },
    });
    const roleOrder: CommitteeRole[] = [
      CommitteeRole.CHAIRMAN,
      CommitteeRole.SECRETARY,
      CommitteeRole.INTERNAL_REVIEWER,
    ];
    committeeScores.sort(
      (left, right) => roleOrder.indexOf(left.role!) - roleOrder.indexOf(right.role!),
    );

    const templatePath = require('path').join(
      process.cwd(),
      'src',
      'templates',
      'NIIE-KLTN013.docx',
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        'Không tìm thấy file mẫu NIIE-KLTN013.docx. Vui lòng upload template.'
      );
    }

    const fileContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(fileContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Fetch all projects sharing the same topic (if any)
    let relatedProjects = [project];
    if (project.topic_id) {
      relatedProjects = await this.prisma.project.findMany({
        where: { topic_id: project.topic_id, status: 'APPROVED', deleted_at: null },
        include: {
          student: true,
          topics: { select: { code: true, name: true } },
        },
        orderBy: { student: { first_name: 'asc' } },
      });
    }

    const fmt = (n?: number | null) => (n != null ? n.toFixed(2) : '');

    const students = await Promise.all(
      relatedProjects.map(async (p, idx) => {
        const pTranscript = await this.buildTranscript(p.id);
        const pCommitteeScores = await this.prisma.independent_scores.findMany({
          where: {
            project_id: p.id,
            scoring_type: ScoringType.COMMITTEE,
            role: { in: [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] },
            deleted_at: null,
          },
          include: { teachers: true },
        });
        pCommitteeScores.sort(
          (left, right) => roleOrder.indexOf(left.role!) - roleOrder.indexOf(right.role!),
        );

        const studentData: Record<string, any> = {
          stt: idx + 1,
          student_last_name: `${p.student.last_name || ''} ${p.student.middle_name || ''}`.trim(),
          student_first_name: p.student.first_name || '',
          student_name: `${p.student.first_name} ${p.student.middle_name} ${p.student.last_name}`.trim(),
          student_id: p.student.student_id,
          final_score_text: scoreToText(pTranscript.finalScore),
          final_score: fmt(pTranscript.finalScore),
          gvhd_score: fmt(pTranscript.gvhdScore),
          gvpb_score: fmt(pTranscript.externalScore),
          defense_score: fmt(pTranscript.othersAverage),
        };

        pCommitteeScores.forEach((s, cIdx) => {
          studentData[`committee_${cIdx + 1}_name`] = s.teachers.name;
          studentData[`committee_${cIdx + 1}_score`] = fmt(s.score);
        });

        return studentData;
      }),
    );

    const now = new Date();
    // Maintain backwards compatibility for global tags with the first student, 
    // but also provide the `students` array for loop rendering.
    const firstStudent = students.find(s => s.student_id === project.student.student_id) || students[0];

    const templateData: Record<string, any> = {
      ...firstStudent, // Fallback for templates that don't use {#students} loop yet
      students, // Array for {#students} ... {/students} loop
      day: now.getDate().toString().padStart(2, '0'),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      year: now.getFullYear().toString(),
      project_name: project.topics?.name ?? project.project_name,
      project_code: project.topics?.code ?? project.project_id,
      chairman_name:
        committeeScores.find((score) => score.role === CommitteeRole.CHAIRMAN)
          ?.teachers.name ?? '',
      secretary_name:
        committeeScores.find((score) => score.role === CommitteeRole.SECRETARY)
          ?.teachers.name ?? '',
    };

    doc.render(templateData);

    return doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  }

  async finalizeMeeting(projectId: number, userId: number, role: string) {
    const staff = this.isStaff(role);
    if (!staff) {
      const access = await this.assertMeetingAccess(projectId, userId, role);
      if (!access.canFinalize) {
        throw new ForbiddenException('Bạn không có quyền chốt điểm hội đồng');
      }
    } else {
      // Staff (admin/secretary): check faculty access instead
      await this.assertTranscriptFacultyAccess(projectId, userId, role);
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
        'Giảng viên hướng dẫn chưa đạt, không thể chốt điểm hội đồng',
      );
    }

    const gvhdScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        scoring_type: ScoringType.GVHD,
        deleted_at: null,
      },
    });
    const submittedStatuses: ScoringStatus[] = [
      ScoringStatus.SUBMITTED,
      ScoringStatus.PASSED,
      ScoringStatus.FAILED,
    ];
    if (
      gvhdScores.length !== 1 ||
      gvhdScores[0].score === null ||
      !submittedStatuses.includes(gvhdScores[0].status)
    ) {
      throw new BadRequestException('Phiếu giảng viên hướng dẫn chưa được nộp đầy đủ.');
    }
    if (gvhdScores[0].score < 4) {
      throw new BadRequestException('Sinh viên chưa đạt vòng giảng viên hướng dẫn, không thể chốt điểm hội đồng.');
    }

    const committeeScores = await this.prisma.independent_scores.findMany({
      where: {
        project_id: projectId,
        scoring_type: ScoringType.COMMITTEE,
        deleted_at: null,
      },
    });

    if (committeeScores.length === 0) {
      throw new BadRequestException('Đề tài chưa có phiếu chấm hội đồng');
    }

    const externalScores = committeeScores.filter(
      (score) => score.role === CommitteeRole.EXTERNAL_REVIEWER,
    );
    const internalScores = committeeScores.filter(
      (score) => score.role !== CommitteeRole.EXTERNAL_REVIEWER,
    );
    const missing = committeeScores.filter(
      (score) => score.score === null || !submittedStatuses.includes(score.status),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        'Tất cả thành viên hội đồng phải có điểm trước khi chốt',
      );
    }

    const internalRoleCounts = [
      CommitteeRole.CHAIRMAN,
      CommitteeRole.SECRETARY,
      CommitteeRole.INTERNAL_REVIEWER,
    ].map((memberRole) =>
      internalScores.filter((score) => score.role === memberRole).length,
    );
    if (
      externalScores.length !== 1 ||
      internalScores.length !== 3 ||
      internalRoleCounts.some((count) => count !== 1)
    ) {
      throw new BadRequestException(
        'Cần tối thiểu 3 thành viên hội đồng để chốt điểm',
      );
    }

    const defenseScore =
      internalScores.reduce((sum, s) => sum + (s.score || 0), 0) /
      internalScores.length;
    const failedCount = committeeScores.filter(
      (s) => (s.score || 0) < 4,
    ).length;
    const passed = failedCount === 0;

    const gvhd = gvhdScores[0].score;

    const externalScore = externalScores[0].score ?? 0;
    const finalScore = Math.min(
      10,
      gvhd * 0.4 + externalScore * 0.2 + defenseScore * 0.4,
    );
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (
      gvhdScores[0].student_id !== project.student_id ||
      committeeScores.some((score) => score.student_id !== project.student_id) ||
      (result && result.student_id !== project.student_id)
    ) {
      throw new BadRequestException('Dữ liệu phiếu chấm không khớp với sinh viên của đề tài.');
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

  async getTranscriptReview(projectId: number, userId: number, role: string) {
    await this.assertTranscriptFacultyAccess(projectId, userId, role);

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
          teacher: { select: { id: true, name: true, teacher_id: true, faculty_id: true } },
          topics: { select: { code: true, name: true } },
        },
      }),
      this.prisma.independent_scores.findMany({
        where: { project_id: projectId, deleted_at: null },
        include: {
          teachers: { select: { teacher_id: true, name: true } },
        },
        orderBy: { scoring_type: 'asc' },
      }),
      this.prisma.scoring_results.findUnique({
        where: { project_id: projectId },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const submittedStatuses: ScoringStatus[] = [
      ScoringStatus.SUBMITTED,
      ScoringStatus.PASSED,
      ScoringStatus.FAILED,
    ];

    const gvhd = scores.find((s) => s.scoring_type === ScoringType.GVHD);
    const committee = scores.filter((s) => s.scoring_type === ScoringType.COMMITTEE);
    const external = committee.find((s) => s.role === CommitteeRole.EXTERNAL_REVIEWER);
    const internalScores = committee.filter((s) =>
      ([CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] as CommitteeRole[]).includes(s.role as CommitteeRole),
    );

    // Determine readiness
    const gvhdSubmitted = gvhd && gvhd.score !== null && submittedStatuses.includes(gvhd.status);
    const gvhdPassed = gvhdSubmitted && (gvhd?.score ?? 0) >= 4;
    const gvhdFailed = gvhdSubmitted && (gvhd?.score ?? 0) < 4;
    const externalSubmitted = external && external.score !== null && submittedStatuses.includes(external.status);
    const internalRoles = [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER] as CommitteeRole[];
    const internalComplete = internalRoles.every(
      (r) => internalScores.filter((s) => s.role === r && s.score !== null && submittedStatuses.includes(s.status)).length === 1,
    );
    const allSubmitted = gvhdSubmitted && externalSubmitted && internalComplete && committee.length === 4 && scores.length === 5;

    let readinessStatus: string;
    if (result?.final_status === 'REJECTED_GVHD' || gvhdFailed) {
      readinessStatus = 'BLOCKED_GVHD';
    } else if (!allSubmitted) {
      readinessStatus = 'IN_PROGRESS';
    } else if (!this.isFinalized(result)) {
      readinessStatus = 'AWAITING_FINALIZATION';
    } else {
      readinessStatus = result?.is_published ? 'PUBLISHED' : 'READY';
    }

    // Calculate preview scores if possible
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const internalAvg = internalScores.length > 0
      ? round2(internalScores.reduce((sum, s) => sum + (s.score ?? 0), 0) / internalScores.length)
      : null;
    const weightedScore = gvhd?.score != null && external?.score != null && internalAvg !== null
      ? round2(gvhd.score * 0.4 + external.score * 0.2 + internalAvg * 0.4)
      : null;
    const bonusScore = result?.bonus_score ?? 0;
    const finalScore = weightedScore !== null ? Math.min(10, round2(weightedScore + bonusScore)) : null;

    return {
      projectId: project.id,
      projectCode: project.topics?.code ?? project.project_id,
      projectName: project.topics?.name ?? project.project_name,
      student: project.student ? {
        studentId: project.student.student_id,
        firstName: project.student.first_name,
        middleName: project.student.middle_name,
        lastName: project.student.last_name,
        className: project.student.class_name,
      } : null,
      supervisor: { id: project.teacher.id, code: project.teacher.teacher_id, name: project.teacher.name },
      readinessStatus,
      isFinalized: this.isFinalized(result),
      isPublished: result?.is_published ?? false,
      finalStatus: result?.final_status ?? null,
      gvhdSheet: gvhd ? {
        id: gvhd.id,
        teacherId: gvhd.teacher_id,
        teacherName: gvhd.teachers.name,
        teacherCode: gvhd.teachers.teacher_id,
        score: gvhd.score,
        maxScore: gvhd.max_score,
        status: gvhd.status,
        notes: gvhd.notes,
        strengths: gvhd.strengths,
        weaknesses: gvhd.weaknesses,
        submittedAt: gvhd.submitted_at,
        gvhdPassed,
      } : null,
      externalSheet: external ? {
        id: external.id,
        teacherId: external.teacher_id,
        teacherName: external.teachers.name,
        teacherCode: external.teachers.teacher_id,
        score: external.score,
        maxScore: external.max_score,
        status: external.status,
        notes: external.notes,
        strengths: external.strengths,
        weaknesses: external.weaknesses,
        submittedAt: external.submitted_at,
      } : null,
      committeeSheets: committee
        .filter((s) => s.role !== CommitteeRole.EXTERNAL_REVIEWER)
        .sort((a, b) => {
          const order: CommitteeRole[] = [CommitteeRole.CHAIRMAN, CommitteeRole.SECRETARY, CommitteeRole.INTERNAL_REVIEWER];
          return order.indexOf(a.role as CommitteeRole) - order.indexOf(b.role as CommitteeRole);
        })
        .map((s) => ({
          id: s.id,
          teacherId: s.teacher_id,
          teacherName: s.teachers.name,
          teacherCode: s.teachers.teacher_id,
          role: s.role,
          score: s.score,
          maxScore: s.max_score,
          status: s.status,
          notes: s.notes,
          strengths: s.strengths,
          weaknesses: s.weaknesses,
          submittedAt: s.submitted_at,
        })),
      internalAverage: internalAvg,
      weightedScore,
      bonusScore,
      bonusNote: result?.bonus_note ?? null,
      finalScore,
    };
  }

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
          topics: { select: { code: true, name: true } },
        },
      }),
      this.prisma.independent_scores.findMany({
        where: { project_id: projectId, deleted_at: null },
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

    const internalRoles: CommitteeRole[] = [
      CommitteeRole.CHAIRMAN,
      CommitteeRole.SECRETARY,
      CommitteeRole.INTERNAL_REVIEWER,
    ];
    const submittedStatuses: ScoringStatus[] = [
      ScoringStatus.SUBMITTED,
      ScoringStatus.PASSED,
      ScoringStatus.FAILED,
    ];
    if (
      result?.student_id !== project.student_id ||
      scores.some((score) => score.student_id !== project.student_id)
    ) {
      throw new BadRequestException('Dữ liệu phiếu chấm không khớp với sinh viên của đề tài.');
    }

    if (
      scores.filter((score) => score.scoring_type === ScoringType.GVHD).length !== 1 ||
      gvhd?.score === null ||
      gvhd?.score === undefined ||
      !submittedStatuses.includes(gvhd.status)
    ) {
      throw new BadRequestException('Thiếu điểm giảng viên hướng dẫn');
    }
    if (
      committee.filter((score) => score.role === CommitteeRole.EXTERNAL_REVIEWER).length !== 1 ||
      external?.score === null ||
      external?.score === undefined ||
      !submittedStatuses.includes(external.status)
    ) {
      throw new BadRequestException('Thiếu điểm phản biện ngoài');
    }
    if (
      others.length !== 3 ||
      internalRoles.some(
        (memberRole) => others.filter((score) => score.role === memberRole).length !== 1,
      ) ||
      others.some(
        (score) => score.score === null || score.score === undefined || !submittedStatuses.includes(score.status),
      ) ||
      committee.length !== 4 ||
      scores.length !== 5
    ) {
      throw new BadRequestException(
        'Cần đủ điểm của 3 thành viên hội đồng còn lại',
      );
    }

    const othersAverage =
      others.reduce((sum, s) => sum + (s.score || 0), 0) / others.length;
    const defenseAverage = othersAverage;
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
      projectCode: project.topics?.code ?? project.project_id,
      projectName: project.topics?.name ?? project.project_name,
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

  private async getTranscriptFacultyScope(
    userId: number,
    role: string,
    requestedFacultyId?: string,
  ) {
    if (role.toLowerCase() !== 'secretary') return requestedFacultyId;

    const secretary = await this.prisma.secretary.findUnique({
      where: { user_id: userId },
      select: { faculty_id: true },
    });
    if (!secretary?.faculty_id) {
      throw new ForbiddenException('Tài khoản thư ký chưa được gán khoa.');
    }
    if (requestedFacultyId && requestedFacultyId !== secretary.faculty_id) {
      throw new ForbiddenException('Không thể xem bảng điểm của khoa khác.');
    }
    return secretary.faculty_id;
  }

  private async assertTranscriptFacultyAccess(
    projectId: number,
    userId: number,
    role: string,
  ) {
    if (role.toLowerCase() !== 'secretary') return;
    const facultyId = await this.getTranscriptFacultyScope(userId, role);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { teacher: { select: { faculty_id: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.teacher.faculty_id !== facultyId) {
      throw new ForbiddenException('Không thể thao tác bảng điểm của khoa khác.');
    }
  }

  async getTranscripts(
    userId: number,
    role: string,
    query: QueryTranscriptsDto,
  ) {
    let {
      page = 1,
      limit = 20,
      facultyId,
    } = query;
    let published = query.published;
    let includeInProgress = query.includeInProgress ?? false;

    if (typeof published === 'string') {
      if (published === 'true') published = true;
      else if (published === 'false') published = false;
    }
    if (typeof includeInProgress === 'string') {
      if (includeInProgress === 'true') includeInProgress = true;
      else if (includeInProgress === 'false') includeInProgress = false;
    }

    const staff = this.isStaff(role);
    const scopedFacultyId = await this.getTranscriptFacultyScope(
      userId,
      role,
      facultyId,
    );
    const teacherId = staff ? undefined : await this.resolveTeacherId(userId);

    const debugInfo = { userId, role, staff, scopedFacultyId, teacherId, query };
    console.log('[DEBUG getTranscripts]', debugInfo);
    require('fs').appendFileSync('debug-get-transcripts.json', JSON.stringify({ time: new Date(), ...debugInfo }) + '\n');

    const projects = await this.prisma.project.findMany({
      where: {
        status: 'APPROVED',
        deleted_at: null,
        independent_scores: {
          some: {
            deleted_at: null,
            ...(teacherId
              ? { teacher_id: teacherId, scoring_type: ScoringType.COMMITTEE }
              : {}),
          },
        },
        ...(scopedFacultyId
          ? { teacher: { faculty_id: scopedFacultyId } }
          : {}),
      },
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
        teacher: { select: { faculty_id: true } },
        topics: { select: { code: true, name: true } },
        independent_scores: {
          where: { deleted_at: null },
          include: { teachers: { select: { teacher_id: true, name: true } } },
        },
        scoring_results: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    const expectedSheets: {
      scoringType: ScoringType;
      role: CommitteeRole | null;
      label: string;
    }[] = [
      { scoringType: ScoringType.GVHD, role: null, label: 'Phiếu giảng viên hướng dẫn' },
      {
        scoringType: ScoringType.COMMITTEE,
        role: CommitteeRole.EXTERNAL_REVIEWER,
        label: 'Phiếu phản biện ngoài',
      },
      ...[
        [CommitteeRole.CHAIRMAN, 'Phiếu Chủ tịch hội đồng'],
        [CommitteeRole.SECRETARY, 'Phiếu Thư ký hội đồng'],
        [CommitteeRole.INTERNAL_REVIEWER, 'Phiếu Phản biện trong'],
      ].map(([memberRole, label]) => ({
        scoringType: ScoringType.COMMITTEE,
        role: memberRole as CommitteeRole,
        label: label as string,
      })),
    ];
    const submittedStatuses: ScoringStatus[] = [
      ScoringStatus.SUBMITTED,
      ScoringStatus.PASSED,
      ScoringStatus.FAILED,
    ];

    const data = projects
      .map((project) => {
        const scores = project.independent_scores;
        const result = project.scoring_results;
        const missingItems: string[] = [];
        let submittedCount = 0;
        const scoreBySheet = new Map<string, (typeof scores)[number]>();
        for (const sheet of expectedSheets) {
          const matches = scores.filter(
            (score) =>
              score.scoring_type === sheet.scoringType &&
              score.role === sheet.role,
          );
          const key = `${sheet.scoringType}:${sheet.role ?? 'NONE'}`;
          if (matches.length !== 1) {
            missingItems.push(`${sheet.label} (cần đúng 1 phiếu)`);
            continue;
          }
          const score = matches[0];
          scoreBySheet.set(key, score);
          if (
            score.student_id !== project.student_id ||
            score.score === null ||
            !submittedStatuses.includes(score.status)
          ) {
            missingItems.push(`${sheet.label} (chưa nộp hoặc sai sinh viên)`);
          } else {
            submittedCount++;
          }
        }
        if (scores.length !== expectedSheets.length) {
          missingItems.push('Cấu hình phiếu không đúng 5 vai trò bắt buộc');
        }
        if (result && result.student_id !== project.student_id) {
          missingItems.push('Bản ghi tổng hợp đang gắn sai sinh viên');
        }

        const gvhd = scoreBySheet.get(`${ScoringType.GVHD}:NONE`);
        const gvhdFailed =
          gvhd?.score !== null &&
          gvhd?.score !== undefined &&
          submittedStatuses.includes(gvhd.status) &&
          gvhd.score < 4;
        const allScoresSubmitted = missingItems.length === 0;
        let readinessStatus: string;
        if (result?.final_status === 'REJECTED_GVHD' || gvhdFailed) {
          readinessStatus = 'BLOCKED_GVHD';
        } else if (!allScoresSubmitted) {
          readinessStatus = 'IN_PROGRESS';
        } else if (!this.isFinalized(result)) {
          readinessStatus = 'AWAITING_FINALIZATION';
        } else {
          readinessStatus = result?.is_published ? 'PUBLISHED' : 'READY';
        }
        if (readinessStatus === 'BLOCKED_GVHD') {
          missingItems.unshift('Không đạt điều kiện GVHD; chưa thể chấm tiếp vòng sau');
        } else if (readinessStatus === 'AWAITING_FINALIZATION') {
          missingItems.push('Thư ký hội đồng cần chốt điểm hội đồng');
        }

        const external = scoreBySheet.get(
          `${ScoringType.COMMITTEE}:${CommitteeRole.EXTERNAL_REVIEWER}`,
        );
        const internalScores = [
          CommitteeRole.CHAIRMAN,
          CommitteeRole.SECRETARY,
          CommitteeRole.INTERNAL_REVIEWER,
        ].map((memberRole) =>
          scoreBySheet.get(`${ScoringType.COMMITTEE}:${memberRole}`),
        );
        const completeForTotal =
          readinessStatus === 'READY' || readinessStatus === 'PUBLISHED';
        const round2 = (value: number) => Math.round(value * 100) / 100;
        const committeeAverage = completeForTotal
          ? round2(
              internalScores.reduce((sum, score) => sum + (score?.score ?? 0), 0) /
                internalScores.length,
            )
          : null;
        const weightedScore =
          completeForTotal && gvhd?.score != null && external?.score != null && committeeAverage !== null
            ? round2(gvhd.score * 0.4 + external.score * 0.2 + committeeAverage * 0.4)
            : null;
        const bonusScore = completeForTotal ? (result?.bonus_score ?? 0) : null;
        const finalScore =
          weightedScore !== null && bonusScore !== null
            ? Math.min(10, round2(weightedScore + bonusScore))
            : null;

        return {
          projectId: project.id,
          projectCode: project.topics?.code ?? project.project_id,
          projectName: project.topics?.name ?? project.project_name,
          student: project.student
            ? {
                studentId: project.student.student_id,
                firstName: project.student.first_name,
                middleName: project.student.middle_name,
                lastName: project.student.last_name,
                className: project.student.class_name,
              }
            : null,
          readinessStatus,
          submittedCount,
          requiredCount: expectedSheets.length,
          missingItems,
          gvhdScore: completeForTotal ? (gvhd?.score ?? null) : null,
          externalScore: completeForTotal ? (external?.score ?? null) : null,
          committeeAverage,
          weightedScore,
          bonusScore,
          finalScore,
          finalStatus: result?.final_status ?? null,
          isFinalized: this.isFinalized(result),
          isPublished: result?.is_published ?? false,
          publishedAt: result?.published_at ?? null,
        };
      })
      .filter(
        (row) =>
          (includeInProgress || row.isFinalized) &&
          (published === undefined || row.isPublished === published),
      );

    const total = data.length;
    const start = (page - 1) * limit;
    const finalData = data.slice(start, start + limit);
    const debugReturn = { total, returnedDataCount: finalData.length, initialProjectsCount: projects.length, firstData: data[0] };
    console.log('[DEBUG getTranscripts return]', debugReturn);
    require('fs').appendFileSync('debug-get-transcripts.json', JSON.stringify({ time: new Date(), type: 'return', ...debugReturn }) + '\n');
    return {
      data: finalData,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTranscript(projectId: number, userId: number, role: string) {
    await this.assertTranscriptFacultyAccess(projectId, userId, role);
    const access = await this.assertMeetingAccess(projectId, userId, role);
    const isSecretary = access.staff || access.own?.role === CommitteeRole.SECRETARY;

    const result = await this.prisma.scoring_results.findUnique({
      where: { project_id: projectId },
    });

    if (!this.isFinalized(result)) {
      if (isSecretary) {
        return this.getTranscriptReview(projectId, userId, role);
      }
      throw new BadRequestException('Đề tài chưa chốt điểm hội đồng (Giai đoạn 5)');
    }

    const detail = await this.buildTranscript(projectId);


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
    await this.assertTranscriptFacultyAccess(projectId, userId, role);
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
    await this.assertTranscriptFacultyAccess(projectId, userId, role);
    const access = await this.assertMeetingAccess(projectId, userId, role);
    if (!access.canFinalize) {
      throw new ForbiddenException('Bạn không có quyền công bố bảng điểm');
    }

    const detail = await this.buildTranscript(projectId);
    if (detail.isPublished) {
      throw new BadRequestException('Bảng điểm đã được công bố.');
    }

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
    try {
      const student = await this.resolveOrCreateStudent(userId);

      const project = await this.prisma.project.findUnique({
        where: { student_id: student.id },
      });
      if (!project) {
        return { available: false, reason: 'Bạn chưa có đề tài' };
      }

      const result = await this.prisma.scoring_results.findUnique({
        where: { project_id: project.id },
      });
      if (!result?.is_published) {
        return { available: false, reason: 'Bảng điểm chưa được công bố' };
      }

      return { ...(await this.buildTranscript(project.id)), available: true };
    } catch (error) {
      return this.studentUnavailable(error, 'Bảng điểm chưa sẵn sàng');
    }
  }

  // ============ GIAI ĐOẠN 7: HẬU KIỂM VÀ XẾP HẠNG ============
  // Chỉnh sửa báo cáo theo nhận xét -> Xếp hạng (sort điểm, đồng điểm xử lý thủ công) -> In biểu mẫu.

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
    const { page = 1, limit = 50, facultyId } = query;

    const results = await this.prisma.scoring_results.findMany({
      where: {
        is_published: true,
        final_status: 'PASSED',
        ...(facultyId
          ? { projects: { teacher: { faculty_id: facultyId } } }
          : {}),
      },
      include: {
        projects: {
          select: {
            project_id: true,
            project_name: true,
            topics: { select: { code: true, name: true } },
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
        projectCode: r.projects.topics?.code ?? r.projects.project_id,
        projectName: r.projects.topics?.name ?? r.projects.project_name,
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
        latestRevisionFile: latestRevision?.original_name || latestRevision?.file_name || null,
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

  async getPrintSheet(userId: number, role: string, facultyId?: string) {
    if (!this.isStaff(role)) {
      throw new ForbiddenException(
        'Chỉ thư ký hệ thống được in bảng điểm lưu trữ',
      );
    }
    const rows = await this.getPostDefenseList(userId, role, {
      page: 1,
      limit: 1000,
      facultyId,
    });
    return { data: rows.data, generatedAt: new Date() };
  }

  async getMyRevision(userId: number) {
    try {
      const student = await this.resolveOrCreateStudent(userId);
      const project = await this.prisma.project.findUnique({
        where: { student_id: student.id },
      });
      if (!project) {
        return { available: false, reason: 'Bạn chưa có đề tài' };
      }
      const result = await this.prisma.scoring_results.findUnique({
        where: { project_id: project.id },
      });
      if (!result?.is_published) {
        return { available: false, reason: 'Bảng điểm chưa được công bố' };
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
              fileName: revision.original_name || revision.file_name,
              fileUrl: revision.file_url,
              submittedAt: revision.submitted_at,
              note: revision.note,
            }
          : null,
      };
    } catch (error) {
      return this.studentUnavailable(error, 'Hồ sơ chỉnh sửa chưa sẵn sàng');
    }
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
      throw new BadRequestException('Đã hết hạn chỉnh sửa báo cáo, không thể nộp');
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

  private studentUnavailable(error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return { available: false as const, reason: response };
      }
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return {
          available: false as const,
          reason: Array.isArray(message) ? message.join(', ') : message,
        };
      }
      return { available: false as const, reason: error.message };
    }
    return { available: false as const, reason: fallback };
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

    // Determine correct template and rubric schema
    let templateName = "";
    let rubricSchema = null;
    
    if (score.scoring_type === ScoringType.GVHD) {
      templateName = "NIIE-KLTN010.docx";
      rubricSchema = RUBRIC_GVHD;
    } else if (score.scoring_type === ScoringType.COMMITTEE && score.role === "EXTERNAL_REVIEWER") {
      templateName = "NIIE-KLTN011.docx";
      rubricSchema = RUBRIC_GVPB;
    } else {
      templateName = "NIIE-KLTN012.docx";
      rubricSchema = RUBRIC_COMMITTEE;
    }

    const templatePath = path.join(
      process.cwd(),
      "src",
      "templates",
      templateName,
    );

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(
        "Không tìm thấy file mẫu " + templateName + " trong thư mục src/templates. Vui lòng cấu hình upload template."
      );
    }

    const fileContent = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(fileContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const rawScores = (score.criteria_scores) || {};
    const templateData = {
      student_name: (score.students.first_name + " " + score.students.middle_name + " " + score.students.last_name).trim(),
      student_id: score.students.student_id,
      project_name: score.projects.project_name,
      course_name: "Khóa luận tốt nghiệp",
      teacher_name: score.teachers.name,
      total_score: score.score || 0,
      notes: score.notes || "",
    };

    if (rubricSchema) {
      rubricSchema.sections.forEach(section => {
        let sectionScore = 0;
        let totalWeight = 0;
        
        section.categories.forEach(cat => {
          let sum = 0;
          let count = 0;
          cat.criteria.forEach(crit => {
            const val = rawScores[crit.id] || 0;
            templateData["c_" + crit.id.replace(/\./g, "_")] = val;
            sum += val;
            count++;
          });
          const catAvg = count > 0 ? sum / count : 0;
          templateData["cat_" + cat.id.replace(/\./g, "_")] = catAvg.toFixed(2);
          sectionScore += catAvg * cat.weight;
          totalWeight += cat.weight;
        });
        
        const finalSectionScore = totalWeight > 0 ? sectionScore / totalWeight : 0;
        templateData["sec_" + section.id] = finalSectionScore.toFixed(2);
      });
    }

    // Render the document
    doc.render(templateData);

    return doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  }
}
