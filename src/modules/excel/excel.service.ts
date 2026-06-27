import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  async parseExcel(buffer: Buffer): Promise<Array<Record<string, any>>> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const headers: string[] = [];
    const result: Array<Record<string, any>> = [];

    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers.push(String(cell.value || '').toLowerCase().trim());
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        if (Object.values(rowData).some((v) => v !== null && v !== undefined && v !== '')) {
          result.push(rowData);
        }
      }
    });

    return result;
  }

  async generateExcel(
    data: Array<Record<string, any>>,
    filename: string,
    sheetName: string = 'Sheet1',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      return Buffer.from(await workbook.xlsx.writeBuffer()) as Buffer;
    }

    const headers = Object.keys(data[0]);
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    data.forEach((item) => {
      const row = headers.map((header) => item[header]);
      worksheet.addRow(row);
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const length = cell.value ? String(cell.value).length : 0;
        if (length > maxLength) {
          maxLength = Math.min(length, 50);
        }
      });
      column.width = maxLength + 2;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer()) as Buffer;
  }

  async exportUsersToExcel(users: Array<{
    mssv?: string | null;
    email: string;
    name?: string | null;
    role: string;
    department?: string | null;
    major?: string | null;
    class?: string | null;
  }>): Promise<Buffer> {
    const data = users.map((user, index) => ({
      stt: index + 1,
      mssv: user.mssv || '',
      ho_ten: user.name || '',
      email: user.email,
      vai_tro: this.translateRole(user.role),
      khoa: typeof user.department === 'object' ? (user.department as any)?.name : user.department || '',
      nganh: typeof user.major === 'object' ? (user.major as any)?.name : user.major || '',
      lop: typeof user.class === 'object' ? (user.class as any)?.name : user.class || '',
    }));

    return this.generateExcel(data, 'danh_sach_nguoi_dung', 'Users');
  }

  private translateRole(role: string): string {
    const roleMap: Record<string, string> = {
      ADMIN: 'Quản trị viên',
      SECRETARY: 'Thư ký',
      TEACHER: 'Giảng viên',
      STUDENT: 'Sinh viên',
    };
    return roleMap[role] || role;
  }

  async exportTopicsToExcel(topics: Array<{
    code: string;
    title: string;
    supervisor: string;
    status: string;
    maxStudents: number;
    registeredCount: number;
    deadline?: Date | null;
  }>): Promise<Buffer> {
    const data = topics.map((topic, index) => ({
      stt: index + 1,
      ma_de_tai: topic.code,
      ten_de_tai: topic.title,
      giang_vien: topic.supervisor,
      trang_thai: this.translateTopicStatus(topic.status),
      sl_dang_ky: topic.registeredCount,
      sl_toi_da: topic.maxStudents,
      han_dang_ky: topic.deadline ? this.formatDate(topic.deadline) : '',
    }));

    return this.generateExcel(data, 'danh_sach_de_tai', 'Topics');
  }

  private translateTopicStatus(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING_APPROVAL: 'Chờ phê duyệt',
      APPROVED: 'Đã duyệt',
      CLOSED: 'Đã đóng',
      REJECTED: 'Từ chối',
    };
    return statusMap[status] || status;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
