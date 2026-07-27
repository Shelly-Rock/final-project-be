export class CreateStudentRespDTO {
  id: number;
  studentId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  className: string;
  major: string;
  courseYear: number;
  academicYear: string;
  projectName: string;
  extraData?: unknown;
  createdAt: string;
}
export class CreateStudentsRespDTO {
  students: CreateStudentRespDTO[];
}
