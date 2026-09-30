import { PaginationRespDTO } from '@/shared';

interface TeacherInfo {
  id: number;
  teacher_id: string;
  name: string;
  email: string;
}

interface TopicInfo {
  id: number;
  name: string;
}

export class GetListStudentRespDTO {
  id: number;
  studentId: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  className: string;
  major: string;
  facultyId?: string | null;
  facultyName?: string | null;
  courseYear: number;
  academicYear: string;
  extraData?: unknown;
  createdAt: string;
  updatedAt: string;
  teacher?: TeacherInfo | null;
  topic?: TopicInfo | null;
}

export class GetListStudentsRespDTO extends PaginationRespDTO {
  students: GetListStudentRespDTO[];
}
