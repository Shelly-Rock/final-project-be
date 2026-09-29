import { BadRequestException, Injectable } from '@nestjs/common';
import { AcademicTitle, Gender } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { ExcelService } from '@/shared/utils';
import { MulterFile } from '@/shared/types/multer-file.type';
import { CreateTeacherDto } from '../dto';
import {
  TEACHER_HEADER_ALIASES,
  TEACHER_IMPORT_FIELDS,
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
    const trimmed = header.trim();
    const lower = trimmed.toLowerCase();
    return (
      TEACHER_HEADER_ALIASES[lower] ??
      TEACHER_HEADER_ALIASES[this.normalizeKey(trimmed)] ??
      trimmed
    );
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

  private async mapTeachers(
    rows: RawTeacherRow[],
  ): Promise<CreateTeacherDto[]> {
    const faculties = await this.prisma.faculty.findMany({
      select: { id: true, name: true },
    });

    return rows.map((row, index) => {
      const rowNumber = index + 2;
      const facultyId = this.resolveFacultyId(
        this.toStringValue(row.facultyId),
        faculties,
        rowNumber,
      );
      const explicitExtraData = this.parseExtraData(row.extraData, rowNumber);
      const additionalData = Object.fromEntries(
        Object.entries(row).filter(
          ([key, value]) =>
            !TEACHER_IMPORT_FIELDS.has(key) &&
            value !== null &&
            value !== undefined &&
            value !== '',
        ),
      );
      const extraData = { ...additionalData, ...explicitExtraData };

      return {
        code: this.toStringValue(row.code),
        name: this.toStringValue(row.name),
        email: this.toStringValue(row.email),
        phone: this.toOptionalString(row.phone),
        facultyId,
        academicTitle: this.normalizeAcademicTitle(
          row.academicTitle,
          rowNumber,
        ),
        position: this.toOptionalString(row.position),
        dateOfBirth: this.normalizeDate(row.dateOfBirth, rowNumber),
        gender: this.normalizeGender(row.gender, rowNumber),
        address: this.toOptionalString(row.address),
        extraData: Object.keys(extraData).length ? extraData : undefined,
      };
    });
  }

  private toStringValue(value: unknown): string {
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

    const normalizedValue = this.normalizeKey(value);
    const faculty = faculties.find(
      (item) =>
        this.normalizeKey(item.id) === normalizedValue ||
        this.normalizeKey(item.name) === normalizedValue ||
        this.normalizeKey(item.name).includes(normalizedValue) ||
        normalizedValue.includes(this.normalizeKey(item.name)),
    );

    if (!faculty) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Không tìm thấy khoa ${value}`,
      );
    }

    return faculty.id;
  }

  private parseExtraData(
    value: unknown,
    rowNumber: number,
  ): Record<string, unknown> {
    if (value === null || value === undefined || value === '') return {};
    if (typeof value !== 'string') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      throw new BadRequestException(
        `Dòng ${rowNumber}: extraData phải là JSON object hợp lệ`,
      );
    }

    try {
      const parsed: unknown = JSON.parse(value);
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
        `Dòng ${rowNumber}: extraData phải là JSON object hợp lệ`,
      );
    }
  }

  private normalizeAcademicTitle(
    value: unknown,
    rowNumber: number,
  ): AcademicTitle | undefined {
    const stringValue = this.toStringValue(value);
    if (!stringValue) return undefined;

    const normalizedValue = this.normalizeKey(stringValue);
    const academicTitleMap: Record<string, AcademicTitle> = {
      master: AcademicTitle.MASTER,
      ths: AcademicTitle.MASTER,
      thacsi: AcademicTitle.MASTER,
      doctor: AcademicTitle.DOCTOR,
      ts: AcademicTitle.DOCTOR,
      tiensi: AcademicTitle.DOCTOR,
      assocprof: AcademicTitle.ASSOC_PROF,
      pgs: AcademicTitle.ASSOC_PROF,
      phogiaosu: AcademicTitle.ASSOC_PROF,
      prof: AcademicTitle.PROF,
      gs: AcademicTitle.PROF,
      giaosu: AcademicTitle.PROF,
    };

    const academicTitle =
      academicTitleMap[normalizedValue] ??
      AcademicTitle[stringValue.toUpperCase() as keyof typeof AcademicTitle];

    if (!academicTitle) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Học hàm, học vị không hợp lệ`,
      );
    }

    return academicTitle;
  }

  private normalizeGender(
    value: unknown,
    rowNumber: number,
  ): Gender | undefined {
    const stringValue = this.toStringValue(value);
    if (!stringValue) return undefined;

    const normalizedValue = this.normalizeKey(stringValue);
    const genderMap: Record<string, Gender> = {
      male: Gender.MALE,
      nam: Gender.MALE,
      female: Gender.FEMALE,
      nu: Gender.FEMALE,
      other: Gender.OTHER,
      khac: Gender.OTHER,
    };

    const gender =
      genderMap[normalizedValue] ??
      Gender[stringValue.toUpperCase() as keyof typeof Gender];

    if (!gender) {
      throw new BadRequestException(
        `Dòng ${rowNumber}: Giới tính không hợp lệ`,
      );
    }

    return gender;
  }

  private normalizeDate(value: unknown, rowNumber: number): Date | undefined {
    if (value === null || value === undefined || value === '') return undefined;

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    } else {
      const text = this.toStringValue(value);
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
        `Dòng ${rowNumber}: Ngày sinh không hợp lệ`,
      );
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
      if (!/^[A-Za-z0-9._-]{2,50}$/.test(teacher.code)) {
        throw new BadRequestException(
          `Dòng ${rowNumber}: Mã giảng viên không đúng định dạng`,
        );
      }
      if (!teacher.name) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu họ tên`);
      }
      if (!teacher.email) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu email`);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) {
        throw new BadRequestException(`Dòng ${rowNumber}: Email không hợp lệ`);
      }
      if (!teacher.facultyId) {
        throw new BadRequestException(`Dòng ${rowNumber}: Thiếu mã khoa`);
      }
      if (teacher.phone && !/^0[35789][0-9]{8}$/.test(teacher.phone)) {
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
      duplicateMessages.push(
        `Email: ${Array.from(duplicateEmails).join(', ')}`,
      );
    }

    throw new BadRequestException(
      ['Các dữ liệu sau đã tồn tại:', ...duplicateMessages].join('\n'),
    );
  }
}
