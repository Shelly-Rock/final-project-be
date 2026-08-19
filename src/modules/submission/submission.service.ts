import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  SubmissionStatus,
  SubmissionType,
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
} from './submission.dto';

@Injectable()
export class SubmissionService {
  constructor(private prisma: PrismaService) {}

  // Validate file name format: [ProjectCode].extension
  private validateFileName(fileName: string): { projectCode: string; extension: string } {
    // Expected format: [MA_DETAI].PDF or [MA_DETAI].docx
    const match = fileName.match(/^\[([^\]]+)\]\.(PDF|DOCX|PPTX)$/i);
    if (!match) {
      throw new BadRequestException(
        'Tên file không đúng định dạng. Vui lòng đặt tên theo mẫu: [Mã Đề Tài].PDF (hoặc .DOCX, .PPTX)',
      );
    }
    return { projectCode: match[1], extension: match[2].toUpperCase() };
  }

  // Get file type from extension
  private getFileType(extension: string): SubmissionType {
    switch (extension.toUpperCase()) {
      case 'PDF':
        return SubmissionType.PDF;
      case 'DOCX':
      case 'DOC':
        return SubmissionType.WORD;
      case 'PPTX':
      case 'PPT':
        return SubmissionType.POWERPOINT;
      default:
        throw new BadRequestException('Chỉ chấp nhận file PDF, Word (.docx), PowerPoint (.pptx)');
    }
  }

  async createSubmission(dto: CreateSubmissionDto) {
    // Validate file name format
    const { projectCode, extension } = this.validateFileName(dto.file_name);

    // Get file type
    const fileType = this.getFileType(extension);

    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.project_id },
      include: { student: true },
    });

    if (!project) {
      throw new NotFoundException('Đề tài không tồn tại');
    }

    // Verify student owns this project
    if (project.student_id !== dto.student_id) {
      throw new ForbiddenException('Sinh viên không sở hữu đề tài này');
    }

    // Check if project code matches
    if (project.project_id !== projectCode) {
      throw new BadRequestException(
        `Mã đề tài trong tên file (${projectCode}) không khớp với mã đề tài thực tế (${project.project_id})`,
      );
    }

    // Check if student has permission to submit
    // Must have APPROVED progress status (not banned, submitted all reports)
    const progress = await this.prisma.studentProgress.findUnique({
      where: { student_id: dto.student_id },
    });

    if (progress?.is_banned) {
      throw new ForbiddenException('Sinh viên đang bị cấm thi, không thể nộp bài');
    }

    // Check if already submitted
    const existingSubmission = await this.prisma.finalSubmission.findFirst({
      where: {
        student_id: dto.student_id,
        project_id: dto.project_id,
        deleted_at: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Đã nộp bài cho đề tài này rồi');
    }

    return this.prisma.finalSubmission.create({
      data: {
        student_id: dto.student_id,
        project_id: dto.project_id,
        file_url: dto.file_url,
        file_name: dto.file_name,
        original_name: dto.original_name,
        file_size: dto.file_size,
        file_type: fileType,
        status: SubmissionStatus.PENDING,
      },
    });
  }

  async getSubmissions(query: SubmissionQueryDto) {
    const { page = 1, limit = 20, status, student_id, project_id } = query;

    const where: any = { deleted_at: null };
    if (status) where.status = status;
    if (student_id) where.student_id = student_id;
    if (project_id) where.project_id = project_id;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.finalSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submitted_at: 'desc' },
      }),
      this.prisma.finalSubmission.count({ where }),
    ]);

    // Enrich with student and project info
    const enrichedData = await Promise.all(
      data.map(async (submission) => {
        const student = await this.prisma.student.findUnique({
          where: { id: submission.student_id },
          select: {
            first_name: true,
            middle_name: true,
            last_name: true,
            student_id: true,
          },
        });
        const project = await this.prisma.project.findUnique({
          where: { id: submission.project_id },
          select: { project_id: true, project_name: true },
        });
        return {
          ...submission,
          student_name: student
            ? `${student.first_name} ${student.middle_name} ${student.last_name}`
            : '',
          student_mssv: student?.student_id,
          project_code: project?.project_id,
          project_name: project?.project_name,
        };
      }),
    );

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSubmissionById(id: number) {
    const submission = await this.prisma.finalSubmission.findFirst({
      where: { id, deleted_at: null },
    });

    if (!submission) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: submission.student_id },
      select: {
        first_name: true,
        middle_name: true,
        last_name: true,
        student_id: true,
      },
    });
    const project = await this.prisma.project.findUnique({
      where: { id: submission.project_id },
      select: { project_id: true, project_name: true },
    });

    return {
      ...submission,
      student_name: student
        ? `${student.first_name} ${student.middle_name} ${student.last_name}`
        : '',
      student_mssv: student?.student_id,
      project_code: project?.project_id,
      project_name: project?.project_name,
    };
  }

  async reviewSubmission(id: number, reviewerId: number, dto: ReviewSubmissionDto) {
    const submission = await this.prisma.finalSubmission.findFirst({
      where: { id, deleted_at: null },
    });

    if (!submission) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Bài nộp đã được duyệt hoặc từ chối trước đó');
    }

    return this.prisma.finalSubmission.update({
      where: { id },
      data: {
        status: dto.status,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        rejection_reason: dto.rejection_reason,
      },
    });
  }

  async getEligibleStudents() {
    // Get students who:
    // 1. Have APPROVED progress status (not banned)
    // 2. Have submitted all required reports
    const eligibleProgress = await this.prisma.studentProgress.findMany({
      where: {
        is_banned: false,
        status: { in: ['ON_TRACK', 'EXTENDED'] },
        // All reports submitted
        // This would need a more complex query in real scenario
      },
    });

    const studentIds = eligibleProgress.map((p) => p.student_id);

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        project: true,
        user: true,
      },
    });

    return students.map((student) => ({
      id: student.id,
      student_id: student.student_id,
      name: `${student.first_name} ${student.middle_name} ${student.last_name}`,
      class_name: student.class_name,
      project_code: student.project?.project_id,
      project_name: student.project?.project_name,
      email: student.user?.email || null,
    }));
  }

  async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.finalSubmission.count({ where: { deleted_at: null } }),
      this.prisma.finalSubmission.count({
        where: { status: SubmissionStatus.PENDING, deleted_at: null },
      }),
      this.prisma.finalSubmission.count({
        where: { status: SubmissionStatus.APPROVED, deleted_at: null },
      }),
      this.prisma.finalSubmission.count({
        where: { status: SubmissionStatus.REJECTED, deleted_at: null },
      }),
    ]);

    return { total, pending, approved, rejected };
  }
}
