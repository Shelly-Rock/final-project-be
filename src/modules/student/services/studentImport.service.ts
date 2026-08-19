import { Injectable, BadRequestException } from '@nestjs/common';
import { ExcelService } from '@/shared/utils';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import { STUDENT_HEADER } from '../constrants';
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
    const headers = this.excelService.getHeaders(wsh);
    this.excelService.validateHeaders(headers, STUDENT_HEADER, true);
    const students = this.excelService.parseRows<CreateStudentReqDTO>(
      wsh,
      headers,
    );
    await this.validateStudents(students);
    return students;
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

    const duplicateStudentIds: string[] = existingStudents.map((s) => s.student_id);
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
