import { PaginationRespDTO } from '@/shared';

interface TeacherInfo {
  id: number;
  teacher_id: string;
  name: string;
  email: string;
}

export class GetListStudentRespDTO {
  id: number;
  studentId: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  className: string;
  major: string;
  courseYear: number;
  academicYear: string;
  extraData?: unknown;
  createdAt: string;
  updatedAt: string;
  teacher?: TeacherInfo;
}

export class GetListStudentsRespDTO extends PaginationRespDTO {
  students: GetListStudentRespDTO[];
}
