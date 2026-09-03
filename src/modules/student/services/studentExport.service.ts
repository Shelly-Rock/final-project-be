import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '@/core/database/prisma/prisma.service';

@Injectable()
export class ExportStudentService {
  constructor(private readonly prismaService: PrismaService) {}

  async exportStudents(): Promise<Buffer> {
    const students = await this.prismaService.student.findMany({
      orderBy: { student_id: 'asc' },
      include: {
        user: {
          select: { email: true },
        },
        project: {
          select: { project_name: true },
        },
      },
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Students');

    worksheet.columns = [
      { header: 'studentId', key: 'studentId', width: 16 },
      { header: 'email', key: 'email', width: 34 },
      { header: 'firstName', key: 'firstName', width: 18 },
      { header: 'middleName', key: 'middleName', width: 18 },
      { header: 'lastName', key: 'lastName', width: 18 },
      { header: 'dateOfBirth', key: 'dateOfBirth', width: 16 },
      { header: 'gender', key: 'gender', width: 12 },
      { header: 'className', key: 'className', width: 18 },
      { header: 'major', key: 'major', width: 28 },
      { header: 'courseYear', key: 'courseYear', width: 14 },
      { header: 'academicYear', key: 'academicYear', width: 18 },
      { header: 'projectName', key: 'projectName', width: 32 },
      { header: 'extraData', key: 'extraData', width: 24 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const student of students) {
      worksheet.addRow({
        studentId: student.student_id,
        email: student.email,
        firstName: student.first_name,
        middleName: student.middle_name,
        lastName: student.last_name,
        dateOfBirth: student.date_of_birth.toISOString().slice(0, 10),
        gender: student.gender,
        className: student.class_name,
        major: student.major,
        courseYear: student.course_year,
        academicYear: student.academic_year,
        projectName: student.project?.project_name ?? '',
        extraData: student.extra_data
          ? JSON.stringify(student.extra_data)
          : '{}',
      });
    }

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }
}
