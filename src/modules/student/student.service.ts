import { Injectable } from '@nestjs/common';
import {
  CreateStudentService,
  ImportStudentService,
  GetStudentListService,
} from './services';
import { MulterFile } from '@/shared/types/multer-file.type';
import { PaginationReqDTO } from '@/shared';
@Injectable()
export class StudentService {
  constructor(
    private readonly createSV: CreateStudentService,
    private readonly importSV: ImportStudentService,
    private readonly getListSV: GetStudentListService,
  ) {}
  async importStudents(file: MulterFile) {
    const students = await this.importSV.importStudents(file);
    await this.createSV.createStudent(students);
  }
  async getListStudents(query: PaginationReqDTO) {
    return this.getListSV.getStudentList(query);
  }
}
