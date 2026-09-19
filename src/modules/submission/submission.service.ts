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
    let student = await this.prisma.student.findFirst({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, user_id: true, student_id: true },
    });

    if (!student) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true },
      });
      if (!user) {
        throw new ForbiddenException('User not found');
      }

      student = await this.prisma.student.create({
        data: {
          user: { connect: { id: userId } },
          student_id: `SV_${Date.now()}`,
          first_name: user.username || 'Student',
          middle_name: '',
          last_name: '',
          email: user.email,
          class_name: 'TBD',
          major: 'TBD',
          gender: 'MALE',
          date_of_birth: new Date('2000-01-01'),
          course_year: 1,
          academic_year: new Date().getFullYear().toString(),
        },
        select: { id: true, user_id: true, student_id: true },
      });
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
    // Trim spaces from project code to handle any extra spaces
    const projectCode = match[1].trim();
    const extension = match[2].toUpperCase();
    return { projectCode, extension };
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
      include: { student: true, topics: { select: { period_id: true, code: true } } },
    }) as any;

    if (!project) {
      throw new NotFoundException('Đề tài không tồn tại');
    }

    // Verify student owns this project
    if (project.student_id !== dto.student_id) {
      throw new ForbiddenException('Sinh viên không sở hữu đề tài này');
    }

    // Check if project code matches (use topics.code instead of project.project_id)
    const dbTopicCode = project.topics?.code?.trim() || '';
    if (dbTopicCode !== projectCode) {
      throw new BadRequestException(
        `Mã đề tài trong tên file (${projectCode}) không khớp với mã đề tài thực tế (${dbTopicCode})`,
      );
    }

    // Use unified validation logic (now includes is_leader, deadline, ban status, existing submission)
    await this.validateSubmissionEligibility(dto.student_id, project);

    return this.prisma.final_submissions.create({
      data: {
        submitted_by_student_id: dto.student_id,
        topic_id: project.topic_id,
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

  async initDriveUpload(user: JwtUser, dto: InitDriveUploadDto) {
    const { projectId, fileName, fileSize, mimeType } = dto;
    const { projectCode } = this.validateFileName(fileName);
    
    const project = await this.prisma.project.findUnique({ 
      where: { id: projectId },
      include: { topics: { select: { period_id: true, code: true } } }
    });
    if (!project) throw new NotFoundException('Đề tài không tồn tại');
    
    // Use topic.code instead of project.project_id for project code comparison
    // because project_id currently contains UUID in the database
    const dbTopicCode = project.topics?.code?.trim() || '';
    if (!dbTopicCode) {
      throw new BadRequestException('Đề tài chưa có mã đề tài trong hệ thống');
    }
    
    if (dbTopicCode !== projectCode) {
      throw new BadRequestException(
        `Tên file không khớp với mã đề tài. Trong file: [${projectCode}], Trong hệ thống: ${dbTopicCode}`
      );
    }

    // Resolve student from JWT
    const student = await this.resolveStudentByUserId(user.sub);

    // Verify student owns this project
    if (project.student_id !== student.id) {
      throw new ForbiddenException('Bạn không sở hữu đề tài này');
    }

    // Check eligibility before initializing upload
    // This includes: is_leader, ban status, deadline, existing submission
    try {
      await this.validateSubmissionEligibility(student.id, project);
    } catch (error) {
      // Convert validation errors to user-friendly messages
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error; // Re-throw as-is for clear message
      }
      throw new BadRequestException('Không đủ điều kiện nộp bài');
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
      
      // Handle specific Google Drive errors
      if (error.response?.data?.error?.message) {
        throw new BadRequestException(`Lỗi Google Drive: ${error.response.data.error.message}`);
      }
      
      if (error.code === '401' || error.code === 401) {
        throw new BadRequestException('Lỗi xác thực Google Drive. Vui lòng liên hệ quản trị viên.');
      }
      
      if (error.code === '403' || error.code === 403) {
        throw new BadRequestException('Không có quyền truy cập Google Drive. Vui lòng liên hệ quản trị viên.');
      }
      
      throw new BadRequestException(`Không thể khởi tạo phiên tải lên Google Drive: ${error.message}`);
    }
  }

  async confirmDriveUpload(user: JwtUser, dto: ConfirmDriveUploadDto) {
    const student = await this.resolveStudentByUserId(user.sub);
    const { extension } = this.validateFileName(dto.fileName);
    const fileType = this.getFileType(extension);

    // Get the student's project to find the topic_id
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { topics: { select: { period_id: true } } }
    });
    if (!project) throw new NotFoundException('Không tìm thấy project');
    if (!project.topic_id) throw new NotFoundException('Project chưa thuộc đề tài nào');

    // Verify student owns this project
    if (project.student_id !== student.id) {
      throw new ForbiddenException('Bạn không sở hữu đề tài này');
    }

    // Check eligibility before confirming
    try {
      await this.validateSubmissionEligibility(student.id, project);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không đủ điều kiện nộp bài');
    }

    // Check existing submission
    const existingSubmission = await this.prisma.final_submissions.findFirst({
      where: {
        topic_id: project.topic_id,
        deleted_at: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Đã nộp bài báo cáo cho nhóm này rồi.');
    }

    return this.prisma.final_submissions.create({
      data: {
        submitted_by_student_id: student.id,
        topic_id: project.topic_id,
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

  // ========== VALIDATION LOGIC ==========

  /**
   * Validate submission eligibility - used by both getMyEligibility and createSubmission
   * @throws ForbiddenException or BadRequestException if validation fails
   */
  private async validateSubmissionEligibility(studentId: number, project: any) {
    // Check is_leader status
    if (!project.is_leader) {
      throw new ForbiddenException('Chỉ trưởng nhóm mới được phép nộp báo cáo tổng');
    }

    // Check ban status
    const progress = await this.prisma.student_progress.findUnique({
      where: { student_id: studentId },
    });

    if (progress?.is_banned) {
      throw new ForbiddenException('Sinh viên đang bị cấm thi, không thể nộp bài');
    }

    // Check progress status
    if (progress?.status && progress.status !== 'ON_TRACK' && progress.status !== 'EXTENDED') {
      throw new ForbiddenException('Trạng thái tiến độ không cho phép nộp bài');
    }

    // Check deadline (nếu có period)
    if (project.topics?.period_id) {
      await this.deadlinePolicy.assertFinalSubmissionOpen(project.topics.period_id);
    }

    // Check existing submission
    const existingSubmission = await this.prisma.final_submissions.findFirst({
      where: {
        submitted_by_student_id: studentId,
        topic_id: project.topic_id,
        deleted_at: null,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Đã nộp bài cho đề tài này rồi');
    }
  }

  async getMyEligibility(user: JwtUser) {
    const student = await this.resolveStudentByUserId(user.sub);
    const project = await this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
      include: { 
        topics: { select: { period_id: true } }
      },
      orderBy: { created_at: 'desc' },
    });

    if (!project) {
      return { 
        eligible: false, 
        reason: 'Bạn chưa tham gia đề tài nào' 
      };
    }

    // Use validation logic (now includes is_leader check)
    try {
      await this.validateSubmissionEligibility(student.id, project);
      return {
        eligible: true,
        reason: undefined,
        isLeader: project.is_leader,
        topicId: project.topic_id,
      };
    } catch (error) {
      return {
        eligible: false,
        reason: error instanceof Error ? error.message : 'Không đủ điều kiện nộp bài',
        isLeader: project.is_leader,
        topicId: project.topic_id,
      };
    }
  }

  async getMySubmissions(user: JwtUser) {
    const student = await this.resolveStudentByUserId(user.sub);
    const project = await this.prisma.project.findFirst({
      where: { student_id: student.id, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });

    if (!project || !project.topic_id) return [];

    const submissions = await this.prisma.final_submissions.findMany({
      where: {
        topic_id: project.topic_id,
        deleted_at: null,
      },
      orderBy: { submitted_at: 'desc' },
      include: {
        topics: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return submissions.map((submission) => ({
      ...submission,
      project_code: submission.topics?.code,
      project_name: submission.topics?.name,
    }));
  }

  async getSubmissions(query: SubmissionQueryDto) {
    const { page = 1, limit = 20, status, student_id, project_id } = query;

    const where: any = { deleted_at: null };
    if (status) where.status = status;
    if (student_id) where.submitted_by_student_id = student_id;
    if (project_id) where.topic_id = project_id; // Mapping frontend project_id to topic_id

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
          where: { id: submission.submitted_by_student_id },
          select: {
            first_name: true,
            middle_name: true,
            last_name: true,
            student_id: true,
          },
        });
        const topic = await this.prisma.topics.findUnique({
          where: { id: submission.topic_id },
          select: { code: true, name: true },
        });
        return {
          ...submission,
          student_name: student
            ? `${student.first_name} ${student.middle_name} ${student.last_name}`
            : '',
          student_mssv: student?.student_id,
          project_code: topic?.code,
          project_name: topic?.name,
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
      where: { id: submission.submitted_by_student_id },
      select: {
        first_name: true,
        middle_name: true,
        last_name: true,
        student_id: true,
      },
    });
    const topic = await this.prisma.topics.findUnique({
      where: { id: submission.topic_id },
      select: { code: true, name: true },
    });

    return {
      ...submission,
      student_name: student
        ? `${student.first_name} ${student.middle_name} ${student.last_name}`
        : '',
      student_mssv: student?.student_id,
      project_code: topic?.code,
      project_name: topic?.name,
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
