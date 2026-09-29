import { BadRequestException, Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { ExcelService } from '@/shared/utils';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateStudentReqDTO } from '@/modules/student/dto';
import {
  STUDENT_HEADER_ALIASES,
  STUDENT_IMPORT_FIELDS,
  STUDENT_REQUIRED_HEADERS,
} from '../constrants';
import { MulterFile } from '@/shared/types/multer-file.type';

@Injectable()
export class ImportStudentService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly prismaService: PrismaService,
  ) {}

  async importStudents(file: MulterFile): Promise<CreateStudentReqDTO[]> {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng chọn file Excel để import');
    }

    const workbook = await this.excelService.readWorkbook(file.buffer);
    const worksheet = this.excelService.getWorksheet(workbook);
    const headers = this.excelService
      .getHeaders(worksheet)
      .map((header) => this.normalizeHeader(header));

    this.validateImportHeaders(headers);
    const parsedRows = this.excelService.parseRows<Record<string, unknown>>(
      worksheet,
      headers,
    );
    const students = parsedRows.map((row, index) =>
      this.normalizeStudent(row, index + 2),
    );

    if (students.length === 0) {
      throw new BadRequestException('File Excel không có dữ liệu sinh viên');
    }

    await this.validateStudents(students);
    return students;
  }

  private normalizeHeader(header: string): string {
    const trimmed = header.trim();
    const directAliases: Record<string, string> = {
      khóa: 'courseYear',
      'khóa học': 'courseYear',
    };
    const directAlias = directAliases[trimmed.toLowerCase()];
    if (directAlias) return directAlias;
    return STUDENT_HEADER_ALIASES[this.normalizeKey(trimmed)] ?? trimmed;
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private validateImportHeaders(headers: string[]): void {
    this.excelService.validateHeaders(headers, STUDENT_REQUIRED_HEADERS);

    const headerSet = new Set(headers);
    if (
      !headerSet.has('fullName') &&
      !(headerSet.has('firstName') && headerSet.has('lastName'))
    ) {
      throw new BadRequestException(
        'Thiếu header tên sinh viên: dùng hoten/fullName hoặc firstName và lastName',
      );
    }

    if (!headerSet.has('courseYear') && !headerSet.has('academicYear')) {
      throw new BadRequestException(
        'Thiếu header khóa học: dùng khoahoc/courseYear hoặc academicYear',
      );
    }
  }

  private normalizeStudent(
    row: Record<string, unknown>,
    rowNumber: number,
  ): CreateStudentReqDTO {
    const fullName = this.toText(row.fullName);
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName =
      this.toText(row.firstName) || nameParts[nameParts.length - 1] || '';
    const lastName = this.toText(row.lastName) || nameParts[0] || '';
    const middleName =
      this.toText(row.middleName) || nameParts.slice(1, -1).join(' ');

    const courseYear = this.parseCourseYear(
      this.toText(row.courseYear) ? row.courseYear : row.academicYear,
      rowNumber,
    );
    const academicYear = this.toText(row.academicYear) || String(courseYear);

    const explicitExtraData = this.parseExtraData(row.extraData, rowNumber);
    const additionalData = Object.fromEntries(
      Object.entries(row).filter(
        ([key, value]) =>
          !STUDENT_IMPORT_FIELDS.has(key) &&
          value !== null &&
          value !== undefined &&
          value !== '',
      ),
    );
    const extraData = { ...additionalData, ...explicitExtraData };

    const student: CreateStudentReqDTO = {
      studentId: this.toText(row.studentId),
      email: this.toText(row.email).toLowerCase(),
      firstName,
      middleName,
      lastName,
      dateOfBirth: this.toText(row.dateOfBirth)
        ? this.parseDate(row.dateOfBirth, rowNumber)
        : undefined,
      gender: this.toText(row.gender)
        ? this.parseGender(row.gender, rowNumber)
        : undefined,
      className: this.toText(row.className),
      major: this.toText(row.major),
      courseYear,
      academicYear,
      projectName: this.toText(row.projectName),
      extraData: Object.keys(extraData).length ? extraData : undefined,
    };

    const missingValues = [
      ['studentId', student.studentId],
      ['email', student.email],
      ['firstName', student.firstName],
      ['lastName', student.lastName],
      ['className', student.className],
      ['major', student.major],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    if (missingValues.length) {
      throw new BadRequestException(
        `Dòng ${rowNumber} thiếu dữ liệu: ${missingValues.join(', ')}`,
      );
    }

    return student;
  }

  private toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return `${value}`.trim();
    }
    return '';
  }

  private parseCourseYear(value: unknown, rowNumber: number): number {
    const match = this.toText(value).match(/\d{2,4}/);
    const parsed = match ? Number(match[0]) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: courseYear/khóa học không hợp lệ`,
      );
    }
    return parsed;
  }

  private parseDate(value: unknown, rowNumber: number): string {
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    } else {
      const text = this.toText(value);
      const vietnameseDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      date = vietnameseDate
        ? new Date(
            Date.UTC(
              Number(vietnameseDate[3]),
              Number(vietnameseDate[2]) - 1,
              Number(vietnameseDate[1]),
            ),
          )
        : new Date(text);
    }

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: dateOfBirth/ngày sinh không hợp lệ`,
      );
    }
    return date.toISOString().slice(0, 10);
  }

  private parseGender(value: unknown, rowNumber: number): Gender {
    const normalized = this.normalizeKey(this.toText(value));
    const genders: Record<string, Gender> = {
      male: Gender.MALE,
      nam: Gender.MALE,
      m: Gender.MALE,
      female: Gender.FEMALE,
      nu: Gender.FEMALE,
      f: Gender.FEMALE,
      other: Gender.OTHER,
      khac: Gender.OTHER,
    };
    const gender = genders[normalized];
    if (!gender) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: gender/giới tính phải là MALE, FEMALE hoặc OTHER`,
      );
    }
    return gender;
  }

  private parseExtraData(
    extraData: unknown,
    rowNumber: number,
  ): Record<string, unknown> {
    if (extraData === null || extraData === undefined || extraData === '') {
      return {};
    }

    if (typeof extraData !== 'string') {
      if (typeof extraData === 'object' && !Array.isArray(extraData)) {
        return extraData as Record<string, unknown>;
      }
      throw new BadRequestException(
        `Dòng ${rowNumber}: extraData phải là JSON object hợp lệ`,
      );
    }

    try {
      const parsed: unknown = JSON.parse(extraData);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('extraData must be a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        `Dòng ${rowNumber}: extraData phải là JSON object hợp lệ, ví dụ: {"phone":"0901234567"}`,
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

    const [existingStudents, existingEmails] = await Promise.all([
      this.prismaService.student.findMany({
        where: { student_id: { in: studentIds } },
        select: { student_id: true },
      }),
      this.prismaService.user.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
    ]);

    const duplicateMessages: string[] = [];
    if (existingStudents.length) {
      duplicateMessages.push(
        `StudentId: ${existingStudents.map((student) => student.student_id).join(', ')}`,
      );
    }
    if (existingEmails.length) {
      duplicateMessages.push(
        `Email: ${existingEmails.map((user) => user.email).join(', ')}`,
      );
    }

    if (duplicateMessages.length) {
      throw new BadRequestException(
        ['Các dữ liệu sau đã tồn tại:', ...duplicateMessages].join('\n'),
      );
    }
  }

  private async validateStudents(
    students: CreateStudentReqDTO[],
  ): Promise<void> {
    this.checkDuplicateFile(students);
    await this.checkDuplicateDB(students);
  }
}
