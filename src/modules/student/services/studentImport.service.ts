import { Injectable, BadRequestException } from '@nestjs/common';
import { ExcelService } from '@/shared/utils';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import { STUDENT_HEADER, STUDENT_HEADER_ALIASES } from '../constrants';
import { MulterFile } from '@/shared/types/multer-file.type';

@Injectable()
export class ImportStudentService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly prismaService: PrismaService,
  ) {}
  async importStudents(file: MulterFile): Promise<CreateStudentReqDTO[]> {
    const wb = await this.excelService.readWorkbook(file.buffer);
    const wsh = this.excelService.getWorksheet(wb);
    const headers = this.excelService
      .getHeaders(wsh)
      .map((header) => this.normalizeHeader(header));
    this.excelService.validateHeaders(headers, STUDENT_HEADER);
    const parsedStudents = this.excelService.parseRows<CreateStudentReqDTO>(
      wsh,
      headers,
    );
    const students = parsedStudents.map((student) => ({
      ...student,
      extraData: this.parseExtraData(student.extraData),
    }));
    await this.validateStudents(students);
    return students;
  }

  private normalizeHeader(header: string): string {
    const normalizedHeader = header.trim();
    return (
      STUDENT_HEADER_ALIASES[normalizedHeader.toLowerCase()] ?? normalizedHeader
    );
  }

  private parseExtraData(
    extraData: unknown,
  ): Record<string, unknown> | undefined {
    if (extraData === null || extraData === undefined || extraData === '') {
      return undefined;
    }
    if (typeof extraData !== 'string') {
      return extraData as Record<string, unknown>;
    }

    try {
      const parsed: unknown = JSON.parse(extraData);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('extra_data must be a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        'Cột extraData phải là JSON object hợp lệ, ví dụ: {}',
      );
    }
  }
  private checkDuplicateFile(students: CreateStudentReqDTO[]): void {
    const studentCodes = new Set<string>();
    const emails = new Set<string>();

    for (const student of students) {
      if (studentCodes.has(student.studentId)) {
        throw new BadRequestException(
          `MSSV ${student.studentId} bị trùng trong file`,
        );
      }
      studentCodes.add(student.studentId);

      if (emails.has(student.email)) {
        throw new BadRequestException(
          `Email ${student.email} bị trùng trong file`,
        );
      }
      emails.add(student.email);
    }
  }
  private async checkDuplicateDB(
    students: CreateStudentReqDTO[],
  ): Promise<void> {
    const studentIds = students.map((student) => student.studentId);
    const emails = students.map((student) => student.email);

    // Check student_id trùng lặp
    const existingStudents = await this.prismaService.student.findMany({
      where: {
        student_id: {
          in: studentIds,
        },
      },
      select: {
        student_id: true,
      },
    });

    // Check email trùng lặp trong User table
    const existingEmails = await this.prismaService.user.findMany({
      where: {
        email: {
          in: emails,
        },
      },
      select: {
        email: true,
      },
    });

    const duplicateStudentIds: string[] = existingStudents.map(
      (s) => s.student_id,
    );
    const duplicateEmails: string[] = existingEmails.map((u) => u.email);

    if (!duplicateStudentIds.length && !duplicateEmails.length) {
      return;
    }

    const duplicateMessages: string[] = [];

    if (duplicateStudentIds.length) {
      duplicateMessages.push(`StudentId: ${duplicateStudentIds.join(', ')}`);
    }

    if (duplicateEmails.length) {
      duplicateMessages.push(`Email: ${duplicateEmails.join(', ')}`);
    }

    throw new BadRequestException(
      ['Các dữ liệu sau đã tồn tại:', ...duplicateMessages].join('\n'),
    );
  }
  private async validateStudents(
    students: CreateStudentReqDTO[],
  ): Promise<void> {
    this.checkDuplicateFile(students);
    await this.checkDuplicateDB(students);
  }
}
