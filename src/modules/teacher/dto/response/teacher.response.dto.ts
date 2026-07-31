import { Exclude, Expose } from 'class-transformer';
import { Gender, TeacherStatus } from '@prisma/client';

export class TeacherResponseDto {
  @Expose() id: number;
  @Expose() teacher_id: string;
  @Expose() first_name: string;
  @Expose() last_name: string;
  @Expose() full_name: string;
  @Expose() email: string;
  @Expose() phone: string;
  @Expose() department: string;
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

  constructor(partial: Partial<TeacherResponseDto>) {
    Object.assign(this, partial);
  }
}