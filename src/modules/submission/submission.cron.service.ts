import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { google } from 'googleapis';
import { SubmissionStatus, SubmissionType } from './submission.dto';

@Injectable()
export class SubmissionCronService {
  private readonly logger = new Logger(SubmissionCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncDriveSubmissions() {
    this.logger.log('Bắt đầu chạy Cronjob đồng bộ file nộp bài từ Google Drive...');
    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

      const drive = google.drive({ version: 'v3', auth });

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        this.logger.warn('GOOGLE_DRIVE_FOLDER_ID chưa được cấu hình. Bỏ qua cronjob.');
        return;
      }

      // Lấy danh sách file trong thư mục, được tạo trong vòng 24h qua
      const timeMin = new Date();
      timeMin.setHours(timeMin.getHours() - 24);

      const res = await drive.files.list({
        q: `'${folderId}' in parents and createdTime > '${timeMin.toISOString()}' and trashed = false`,
        fields: 'files(id, name, webViewLink, size)',
      });

      const files = res.data.files;
      if (!files || files.length === 0) {
        this.logger.log('Không có file mới nào trên Drive.');
        return;
      }

      this.logger.log(`Tìm thấy ${files.length} file mới. Đang kiểm tra đối chiếu DB...`);

      for (const file of files) {
        const fileName = file.name || '';
        // File chuẩn có tên dạng DTxxxx.PDF
        const match = fileName.match(/^([A-Z0-9]+)\.(.+)$/i);
        if (!match) continue;

        const projectCode = match[1].toUpperCase();
        const extension = match[2].toUpperCase();

        const project = await this.prisma.project.findUnique({
          where: { project_id: projectCode },
          include: { student: true },
        });

        if (!project || !project.student_id) continue;

        const existingSubmission = await this.prisma.final_submissions.findFirst({
          where: { topic_id: project.topic_id, deleted_at: null },
        });

        // Nếu file có trên Drive nhưng DB chưa lưu (do FE gọi confirmDriveUpload thất bại/rớt mạng)
        if (!existingSubmission) {
          let fileType = SubmissionType.WORD;
          if (extension === 'PDF') fileType = SubmissionType.PDF;
          else if (extension === 'PPTX' || extension === 'PPT') fileType = SubmissionType.POWERPOINT;

          await this.prisma.final_submissions.create({
            data: {
              submitted_by_student_id: project.student_id,
              topic_id: project.topic_id,
              file_url: file.webViewLink || '',
              file_name: file.id || '',
              original_name: fileName,
              file_size: parseInt(file.size || '0', 10),
              file_type: fileType,
              status: SubmissionStatus.PENDING,
              updated_at: new Date(),
            },
          });

          this.logger.log(`Đã đồng bộ bổ sung file cho đề tài ${projectCode} (Drive File ID: ${file.id})`);
        }
      }
    } catch (error) {
      this.logger.error('Lỗi khi chạy Cronjob đồng bộ Google Drive:', error);
    }
  }
}


