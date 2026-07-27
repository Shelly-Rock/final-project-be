import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExcelService } from '@/shared/utils';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import {
  CreateStudentReqDTO,
  CreateStudentsRespDTO,
} from '@/modules/student/dto';
import { STUDENT_HEADER } from './constrants';
import { MulterFile } from '@/shared/types/multer-file.type';

@Injectable()
export class StudentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly excelService: ExcelService,
  ) {}

  async importStudents(file: MulterFile) {
    const wb = await this.excelService.readWorkbook(file.buffer);
    const wsh = this.excelService.getWorksheet(wb);
    const headers = this.excelService.getHeaders(wsh);
    this.excelService.validateHeaders(headers, STUDENT_HEADER, true);
    const students = this.excelService.parseRows<CreateStudentReqDTO>(
      wsh,
      headers,
    );
    await this.validateStudents(students);
    const countStudents= await this.createStudent(students);
    return{
      countStudents
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

    const existingStudents = await this.prismaService.student.findMany({
      where: {
        OR: [
          {
            student_id: {
              in: studentIds,
            },
          },
          {
            email: {
              in: emails,
            },
          },
        ],
      },
      select: {
        student_id: true,
        email: true,
      },
    });

    if (!existingStudents.length) {
      return;
    }

    const duplicateStudentIds: string[] = [];
    const duplicateEmails: string[] = [];

    for (const student of existingStudents) {
      if (student.student_id) {
        duplicateStudentIds.push(student.student_id);
      }

      if (student.email) {
        duplicateEmails.push(student.email);
      }
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
  private async createStudent(
    students: CreateStudentReqDTO[],
  ): Promise<number> {
    const studentData = students.map((student) => ({
      student_id: student.studentId,
      email: student.email,
      first_name: student.firstName,
      middle_name: student.middleName,
      last_name: student.lastName,
      date_of_birth: new Date(student.dateOfBirth),
      gender: student.gender,
      class_name: student.className,
      major: student.major,
      course_year: student.courseYear,
      academic_year: student.academicYear,
      extra_data: (student.extraData as Prisma.InputJsonValue) ?? null,
    }));

    const countStudents =  await this.prismaService.student.createMany({data:studentData});
    return countStudents.count;
  }
}
