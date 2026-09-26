import { BadRequestException, Injectable } from '@nestjs/common';
import { AcademicTitle, Gender } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { ExcelService } from '@/shared/utils';
import { MulterFile } from '@/shared/types/multer-file.type';
import { CreateTeacherDto } from '../dto';
import {
  TEACHER_HEADER_ALIASES,
  TEACHER_REQUIRED_HEADERS,
} from '../constrants';

type RawTeacherRow = Record<string, unknown>;

@Injectable()
export class ImportTeacherService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly prisma: PrismaService,
  ) {}

  async importTeachers(file: MulterFile): Promise<CreateTeacherDto[]> {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng chọn file Excel để import');
    }

    const wb = await this.excelService.readWorkbook(file.buffer);
    const wsh = this.excelService.getWorksheet(wb);
    const headers = this.excelService
      .getHeaders(wsh)
      .map((header) => this.normalizeHeader(header));

    this.excelService.validateHeaders(headers, TEACHER_REQUIRED_HEADERS);

    const parsedTeachers = this.excelService.parseRows<RawTeacherRow>(
      wsh,
      headers,
    );
    const teachers = await this.mapTeachers(parsedTeachers);

    await this.validateTeachers(teachers);
    return teachers;
  }

  private normalizeHeader(header: string): string {
    const normalizedHeader = header.trim().toLowerCase();
    return TEACHER_HEADER_ALIASES[normalizedHeader] ?? header.trim();
  }

  private async mapTeachers(
    rows: RawTeacherRow[],
  ): Promise<CreateTeacherDto[]> {
    const [faculties, departments] = await Promise.all([
      this.prisma.faculty.findMany({ select: { id: true, name: true } }),
      this.prisma.department.findMany({
        select: { id: true, name: true, faculty_id: true },
      }),
    ]);

    return rows.map((row, index) => {
      const rowNumber = index + 2;
      const facultyId = this.resolveFacultyId(
        this.toStringValue(row.facultyId),
        faculties,
        rowNumber,
      );
      const departmentId = this.resolveDepartmentId(
        this.toStringValue(row.departmentId),
        facultyId,
        departments,
        rowNumber,
      );

      return {
        code: this.toStringValue(row.code),
        name: this.toStringValue(row.name),
        email: this.toStringValue(row.email),
        phone: this.toOptionalString(row.phone),
        facultyId,
        departmentId,
        academicTitle: this.normalizeAcademicTitle(row.academicTitle, rowNumber),
        position: this.toOptionalString(row.position),
        dateOfBirth: this.normalizeDate(row.dateOfBirth, rowNumber),
        gender: this.normalizeGender(row.gender, rowNumber),
        address: this.toOptionalString(row.address),
      };
    });
  }

  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toOptionalString(value: unknown): string | undefined {
    const stringValue = this.toStringValue(value);
    return stringValue || undefined;
  }

  private resolveFacultyId(
    value: string,
    faculties: { id: string; name: string }[],
    rowNumber: number,
  ): string {
    if (!value) return '';

    const normalizedValue = value.toLowerCase();
    const faculty = faculties.find(
      (item) =>
        item.id.toLowerCase() === normalizedValue ||
        item.name.toLowerCase() === normalizedValue,
    );

    if (!faculty) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Không tìm thấy khoa ${value}`,
      );
    }

    return faculty.id;
  }

  private resolveDepartmentId(
    value: string,
    facultyId: string,
    departments: { id: string; name: string; faculty_id: string }[],
    rowNumber: number,
  ): string {
    if (!value) return '';

    const normalizedValue = value.toLowerCase();
    const department = departments.find(
      (item) =>
        item.faculty_id === facultyId &&
        (item.id.toLowerCase() === normalizedValue ||
          item.name.toLowerCase() === normalizedValue),
    );

    if (!department) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Không tìm thấy bộ môn ${value}`,
      );
    }

    return department.id;
  }

  private normalizeAcademicTitle(
    value: unknown,
    rowNumber: number,
  ): AcademicTitle | undefined {
    const stringValue = this.toStringValue(value);
    if (!stringValue) return undefined;

    const normalizedValue = stringValue.toLowerCase();
    const academicTitleMap: Record<string, AcademicTitle> = {
      master: AcademicTitle.MASTER,
      ths: AcademicTitle.MASTER,
      'thạc sĩ': AcademicTitle.MASTER,
      doctor: AcademicTitle.DOCTOR,
      ts: AcademicTitle.DOCTOR,
      'tiến sĩ': AcademicTitle.DOCTOR,
      assoc_prof: AcademicTitle.ASSOC_PROF,
      pgs: AcademicTitle.ASSOC_PROF,
      'phó giáo sư': AcademicTitle.ASSOC_PROF,
      prof: AcademicTitle.PROF,
      gs: AcademicTitle.PROF,
      'giáo sư': AcademicTitle.PROF,
    };

    const academicTitle =
      academicTitleMap[normalizedValue] ??
      AcademicTitle[stringValue as keyof typeof AcademicTitle];

    if (!academicTitle) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Học hàm, học vị không hợp lệ`,
      );
    }

    return academicTitle;
  }

  private normalizeGender(value: unknown, rowNumber: number): Gender | undefined {
    const stringValue = this.toStringValue(value);
    if (!stringValue) return undefined;

    const normalizedValue = stringValue.toLowerCase();
    const genderMap: Record<string, Gender> = {
      male: Gender.MALE,
      nam: Gender.MALE,
      female: Gender.FEMALE,
      nữ: Gender.FEMALE,
      nu: Gender.FEMALE,
      other: Gender.OTHER,
      khác: Gender.OTHER,
      khac: Gender.OTHER,
    };

    const gender =
      genderMap[normalizedValue] ?? Gender[stringValue as keyof typeof Gender];

    if (!gender) {
      throw new BadRequestException(`Dòng ${rowNumber}: Giới tính không hợp lệ`);
    }

    return gender;
  }

  private normalizeDate(value: unknown, rowNumber: number): Date | undefined {
    if (value === null || value === undefined || value === '') return undefined;

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Dòng ${rowNumber}: Ngày sinh không hợp lệ`);
    }

    return date;
  }

  private async validateTeachers(teachers: CreateTeacherDto[]): Promise<void> {
    if (!teachers.length) {
      throw new BadRequestException('File không có dữ liệu giảng viên');
    }

    this.validateRequiredFields(teachers);
    this.checkDuplicateFile(teachers);
    await this.checkDuplicateDB(teachers);
  }

  private validateRequiredFields(teachers: CreateTeacherDto[]): void {
    teachers.forEach((teacher, index) => {
      const rowNumber = index + 2;
      if (!teacher.code) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu mã giảng viên`);
      }
      if (!/^GV\d+$/.test(teacher.code)) {
        throw new BadRequestException(
          `Dòng ${rowNumber}: Mã giảng viên phải có định dạng GV + số`,
        );
      }
      if (!teacher.name) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu họ tên`);
      }
      if (!teacher.email) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu email`);
      }
      if (!/^[a-zA-Z0-9._%+-]+@nttu\.edu\.vn$/.test(teacher.email)) {
        throw new BadRequestException(
          `Dòng ${rowNumber}: Email phải thuộc domain @nttu.edu.vn`,
        );
      }
      if (!teacher.facultyId) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu mã khoa`);
      }
      if (!teacher.departmentId) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu mã bộ môn`);
      }
      if (
        teacher.phone &&
        !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(teacher.phone)
      ) {
        throw new BadRequestException(
          `Dòng ${rowNumber}: Số điện thoại không đúng định dạng Việt Nam`,
        );
      }
    });
  }

  private checkDuplicateFile(teachers: CreateTeacherDto[]): void {
    const codes = new Set<string>();
    const emails = new Set<string>();

    for (const teacher of teachers) {
      if (codes.has(teacher.code)) {
        throw new BadRequestException(
          `Mã giảng viên ${teacher.code} bị trùng trong file`,
        );
      }
      codes.add(teacher.code);

      if (emails.has(teacher.email)) {
        throw new BadRequestException(
          `Email ${teacher.email} bị trùng trong file`,
        );
      }
      emails.add(teacher.email);
    }
  }

  private async checkDuplicateDB(teachers: CreateTeacherDto[]): Promise<void> {
    const codes = teachers.map((teacher) => teacher.code);
    const emails = teachers.map((teacher) => teacher.email);

    const [existingTeachers, existingUsers] = await Promise.all([
      this.prisma.teacher.findMany({
        where: {
          OR: [{ teacher_id: { in: codes } }, { email: { in: emails } }],
        },
        select: { teacher_id: true, email: true },
      }),
      this.prisma.user.findMany({
        where: {
          OR: [{ username: { in: codes } }, { email: { in: emails } }],
        },
        select: { username: true, email: true },
      }),
    ]);

    const duplicateCodes = new Set<string>();
    const duplicateEmails = new Set<string>();

    existingTeachers.forEach((teacher) => {
      if (teacher.teacher_id) duplicateCodes.add(teacher.teacher_id);
      if (teacher.email) duplicateEmails.add(teacher.email);
    });
    existingUsers.forEach((user) => {
      if (user.username) duplicateCodes.add(user.username);
      if (user.email) duplicateEmails.add(user.email);
    });

    if (!duplicateCodes.size && !duplicateEmails.size) {
      return;
    }

    const duplicateMessages: string[] = [];
    if (duplicateCodes.size) {
      duplicateMessages.push(
        `Mã giảng viên: ${Array.from(duplicateCodes).join(', ')}`,
      );
    }
    if (duplicateEmails.size) {
      duplicateMessages.push(`Email: ${Array.from(duplicateEmails).join(', ')}`);
    }

    throw new BadRequestException(
      ['Các dữ liệu sau đã tồn tại:', ...duplicateMessages].join('\n'),
    );
  }
}
