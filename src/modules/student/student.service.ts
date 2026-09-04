import { Injectable } from '@nestjs/common';
import {
  CreateStudentService,
  ImportStudentService,
  ExportStudentService,
  GetStudentListService,
  GetStudentByIdService,
  UpdateStudentService,
  RemoveStudentService,
} from './services';
import { MulterFile } from '@/shared/types/multer-file.type';
import { PaginationReqDTO } from '@/shared';
import {
  CreateStudentReqDTO,
  UpdateStudentReqDTO,
  GetListStudentRespDTO,
} from './dto';

@Injectable()
export class StudentService {
  constructor(
    private readonly createSV: CreateStudentService,
    private readonly importSV: ImportStudentService,
    private readonly exportSV: ExportStudentService,
    private readonly getListSV: GetStudentListService,
    private readonly getOneSV: GetStudentByIdService,
    private readonly updateSV: UpdateStudentService,
    private readonly removeSV: RemoveStudentService,
  ) {}

  async importStudents(file: MulterFile) {
    const students = await this.importSV.importStudents(file);
    await this.createSV.createStudent(students);
    return {
      success: true,
      message: `Đã import thành công ${students.length} sinh viên`,
      count: students.length,
    };
  }

  async getListStudents(query: PaginationReqDTO) {
    return this.getListSV.getStudentList(query);
  }

  async exportStudents(): Promise<Buffer> {
    return this.exportSV.exportStudents();
  }

  async getStudentById(id: number): Promise<GetListStudentRespDTO> {
    return this.getOneSV.getStudentById(id);
  }

  async getStudentByStudentId(
    studentId: string,
  ): Promise<GetListStudentRespDTO> {
    return this.getOneSV.getStudentByStudentId(studentId);
  }

  async createStudent(dto: CreateStudentReqDTO) {
    await this.createSV.createStudent([dto]);
    return {
      success: true,
      message: 'Tạo sinh viên thành công',
      studentId: dto.studentId,
    };
  }

  async updateStudent(id: number, dto: UpdateStudentReqDTO) {
    const result = await this.updateSV.updateStudent(id, dto);
    return {
      success: true,
      message: 'Cập nhật sinh viên thành công',
      ...result,
    };
  }

  async removeStudent(id: number) {
    return this.removeSV.removeStudent(id);
  }

  async removeStudents(ids: number[]) {
    return this.removeSV.removeStudents(ids);
  }
}
