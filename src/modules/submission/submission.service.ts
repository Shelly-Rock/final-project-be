import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { DeadlinePolicyService } from '@/modules/governance/deadline-policy.service';
import type { JwtUser } from '@/core/auth/interfaces/currentUser.interface';
import {
  SubmissionStatus,
  SubmissionType,
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionQueryDto,
  InitDriveUploadDto,
  ConfirmDriveUploadDto,
} from './submission.dto';

@Injectable()
export class SubmissionService {
  constructor(
    private prisma: PrismaService,
    private readonly deadlinePolicy: DeadlinePolicyService,
  ) {}

  // ========== Actor resolution (JWT sub -> profile id) ==========

  private async resolveTeacherByUserId(userId: number) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, user_id: true, teacher_id: true, name: true },
    });
    if (!teacher) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ giảng viên.',
      );
    }
    return teacher;
  }

  private async resolveStudentByUserId(userId: number) {
    const student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, user_id: true, student_id: true },
    });
    if (!student) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được gắn với hồ sơ sinh viên.',
      );
    }
    return student;
  }

  // student_id luôn suy ra từ JWT — không tin giá trị gửi lên từ body.
  async createSubmissionForActor(user: JwtUser, dto: CreateSubmissionDto) {
    const student = await this.resolveStudentByUserId(user.sub);
    return this.createSubmission({ ...dto, student_id: student.id });
  }

  // final_submissions.reviewed_by là profile id của giảng viên (Teacher.id).
  async reviewSubmissionForActor(
    user: JwtUser,
    submissionId: number,
    dto: ReviewSubmissionDto,
  ) {
    const teacher = await this.resolveTeacherByUserId(user.sub);
    return this.reviewSubmission(submissionId, teacher.id, dto);
  }

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
    const project = (await this.prisma.project.findUnique({
      where: { id: dto.project_id },
      include: { student: true, topics: { select: { period_id: true } } },
    })) as any;

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

    // Enforce FINAL_SUBMISSION deadline when the project is linked to a period
    const periodId: number | null = project.topics?.period_id ?? null;
    if (periodId) {
      await this.deadlinePolicy.assertFinalSubmissionOpen(periodId);
    }

    // Check if student has permission to submit
    // Must have APPROVED progress status (not banned, submitted all reports)
    const progress = await this.prisma.student_progress.findUnique({
      where: { student_id: dto.student_id },
    });

    if (progress?.is_banned) {
      throw new ForbiddenException('Sinh viên đang bị cấm thi, không thể nộp bài');
    }

    // Check if already submitted
    const existingSubmission = await this.prisma.final_submissions.findFirst({
      where: {
        student_id: dto.student_id,
        project_id: dto.project_id,
        deleted_at: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Đã nộp bài cho đề tài này rồi');
    }

    return this.prisma.final_submissions.create({
      data: {
        student_id: dto.student_id,
        project_id: dto.project_id,
        file_url: dto.file_url,
        file_name: dto.file_name,
        original_name: dto.original_name,
        file_size: dto.file_size,
        file_type: fileType,
        status: SubmissionStatus.PENDING,
        updated_at: new Date(),
      },
    });
  }

  // ========== GOOGLE DRIVE RESUMABLE UPLOAD ==========

  async initDriveUpload(dto: InitDriveUploadDto) {
    const { projectId, fileName, fileSize, mimeType } = dto;
    const { projectCode } = this.validateFileName(fileName);
    
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Đề tài không tồn tại');
    if (project.project_id !== projectCode) {
      throw new BadRequestException('Tên file không khớp với mã đề tài');
    }

      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

        const drive = google.drive({ version: 'v3', auth });

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      // 1. Tạo file metadata trống (không có nội dung) để lấy File ID và Link
      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      };

      const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, webViewLink',
      });

      const driveFileId = res.data.id;
      const webViewLink = res.data.webViewLink;

      if (!driveFileId) {
        throw new Error('Khong the tao file tren Google Drive');
      }

      // 2. Sinh sessionUrl cho Resumable Upload bằng cách gọi PATCH update file
      const tokenResponse = await auth.getAccessToken();
      const token = tokenResponse?.token || tokenResponse;
        const patchRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=resumable`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Upload-Content-Type': mimeType,
              'X-Upload-Content-Length': fileSize.toString(),
              'Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
            },
          }
        );
        
        if (!patchRes.ok) {
          const errorBody = await patchRes.text();
          throw new Error(`API trả về ${patchRes.status}: ${errorBody}`);
        }

        const sessionUrl = patchRes.headers.get('location');

        if (!sessionUrl) {
          throw new Error('Google Drive API khong tra ve location header mac du status OK');
        }

      return {
        sessionUrl,
        driveFileId,
        webViewLink,
      };
    } catch (error: any) {
      console.error('Lỗi khi khởi tạo Google Drive upload session:', error);
      throw new BadRequestException(`Không thể khởi tạo phiên tải lên Google Drive: ${error.message}`);
    }
  }

  async confirmDriveUpload(user: JwtUser, dto: ConfirmDriveUploadDto) {
    const student = await this.resolveStudentByUserId(user.sub);
    const { extension } = this.validateFileName(dto.fileName);
    const fileType = this.getFileType(extension);

    // Kiểm tra đã nộp chưa
    const existingSubmission = await this.prisma.final_submissions.findFirst({
      where: {
        project_id: dto.projectId,
        deleted_at: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Đã nộp bài cho đề tài này rồi');
    }

    return this.prisma.final_submissions.create({
      data: {
        student_id: student.id,
        project_id: dto.projectId,
        file_url: dto.webViewLink,
        file_name: dto.driveFileId,
        original_name: dto.fileName,
        file_size: dto.fileSize,
        file_type: fileType,
        status: SubmissionStatus.PENDING,
        updated_at: new Date(),
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
      this.prisma.final_submissions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submitted_at: 'desc' },
      }),
      this.prisma.final_submissions.count({ where }),
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
    const submission = await this.prisma.final_submissions.findFirst({
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
    const submission = await this.prisma.final_submissions.findFirst({
      where: { id, deleted_at: null },
    });

    if (!submission) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Bài nộp đã được duyệt hoặc từ chối trước đó');
    }

    return this.prisma.final_submissions.update({
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
    const eligibleProgress = await this.prisma.student_progress.findMany({
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

  // ========== Student self-service endpoints ==========

  /** Trả về danh sách bài nộp của sinh viên đang đăng nhập — chỉ dữ liệu của chính họ. */
  async getMySubmissions(user: JwtUser) {
    const student = await this.resolveStudentByUserId(user.sub);

    const submissions = await this.prisma.final_submissions.findMany({
      where: { student_id: student.id, deleted_at: null },
      orderBy: { submitted_at: 'desc' },
    });

    if (submissions.length === 0) return [];

    // Enrich với thông tin project (không lộ thông tin sinh viên khác)
    const enriched = await Promise.all(
      submissions.map(async (s) => {
        const project = await this.prisma.project.findUnique({
          where: { id: s.project_id },
          select: { project_id: true, project_name: true },
        });
        return {
          ...s,
          project_code: project?.project_id,
          project_name: project?.project_name,
        };
      }),
    );

    return enriched;
  }

  /**
   * Kiểm tra sinh viên đang đăng nhập có đủ điều kiện nộp bài không.
   * Chỉ trả về trạng thái eligible/not + lý do — không lộ dữ liệu người khác.
   */
  async getMyEligibility(user: JwtUser): Promise<{ eligible: boolean; reason?: string; isLeader?: boolean }> {
    const student = await this.resolveStudentByUserId(user.sub);

    // Kiểm tra quyền đại diện nhóm (trưởng nhóm mới được nộp bài)
    const project = await this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
      select: { is_leader: true, topic_id: true },
    });

    // Nếu đề tài đã được khóa (topic_id != null) thì mới cần kiểm tra is_leader.
    // Đề tài chưa khóa (hoặc topic_id null) → chưa phân công → chưa biết ai là leader.
    if (project?.topic_id) {
      // Kiểm tra topic đã bị locked chưa
      const topic = await this.prisma.topics.findUnique({
        where: { id: project.topic_id },
        select: { locked_at: true },
      });
      if (topic?.locked_at && !project.is_leader) {
        return {
          eligible: false,
          isLeader: false,
          reason: 'Chỉ đại diện nhóm (trưởng nhóm) mới được nộp bài. Vui lòng liên hệ trưởng nhóm của bạn.',
        };
      }
    }

    const progress = await this.prisma.student_progress.findUnique({
      where: { student_id: student.id },
    });

    if (!progress) {
      return { eligible: false, isLeader: project?.is_leader ?? false, reason: 'Chưa có thông tin tiến độ học tập.' };
    }

    if (progress.is_banned) {
      return { eligible: false, isLeader: project?.is_leader ?? false, reason: 'Bạn đang bị cấm thi, không thể nộp bài.' };
    }

    const allowedStatuses = ['ON_TRACK', 'EXTENDED'];
    if (!allowedStatuses.includes(progress.status)) {
      return {
        eligible: false,
        isLeader: project?.is_leader ?? false,
        reason: `Trạng thái tiến độ hiện tại (${progress.status}) chưa đủ điều kiện nộp bài.`,
      };
    }

    return { eligible: true, isLeader: project?.is_leader ?? true };
  }

  async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.final_submissions.count({ where: { deleted_at: null } }),
      this.prisma.final_submissions.count({
        where: { status: SubmissionStatus.PENDING, deleted_at: null },
      }),
      this.prisma.final_submissions.count({
        where: { status: SubmissionStatus.APPROVED, deleted_at: null },
      }),
      this.prisma.final_submissions.count({
        where: { status: SubmissionStatus.REJECTED, deleted_at: null },
      }),
    ]);

    return { total, pending, approved, rejected };
  }
}
