import { Exclude, Expose, Transform } from 'class-transformer';
import { Gender, TeacherStatus } from '@prisma/client';

export class TeacherResponseDto {
  @Expose() id: number;
  @Expose() teacher_id: string;

  @Expose() name: string;

  @Expose() email: string;
  @Expose() phone: string;

  @Expose() faculty_id: string;
  @Expose() department_id: string;

  @Expose()
  @Transform(
    ({ obj }: { obj: { faculty?: { name?: string } } }) => obj.faculty?.name,
  )
  faculty_name: string;

  @Expose()
  @Transform(
    ({ obj }: { obj: { department?: { name?: string } } }) =>
      obj.department?.name,
  )
  department_name: string;

  @Expose() academic_title: string;
  @Expose() position: string;
  @Expose() date_of_birth: Date;
  @Expose() gender: Gender;
  @Expose() address: string;
  @Expose() status: TeacherStatus;
  @Expose() created_at: Date;
  @Expose() updated_at: Date;

  @Exclude() user_id: number;
  @Exclude() deleted_at: Date;

  @Exclude() faculty: any;
  @Exclude() department: any;

  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}
