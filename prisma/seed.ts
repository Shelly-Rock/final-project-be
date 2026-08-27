import { PrismaClient, RegistrationPeriodStatus, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Đang bắt đầu nạp dữ liệu (Seeding) bằng PrismaClient...');

  // Tạo Roles
  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {}, 
    create: {
      name: 'TEACHER',
      display_name: 'Giảng viên',
      description: 'Quyền truy cập dành cho Giảng viên',
      is_system: true,
      priority: 2,
    },
  });
  console.log(`Đã tạo Role: ${teacherRole.name}`);

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      display_name: 'Sinh viên',
      description: 'Quyền truy cập dành cho Sinh viên',
      is_system: true,
      priority: 1,
    },
  });
  console.log(`Đã tạo Role: ${studentRole.name}`);

  // Tạo Khoa & Bộ môn
  const faculty = await prisma.faculty.upsert({
    where: { id: 'KHOA_CNTT' },
    update: {},
    create: {
      id: 'KHOA_CNTT',
      name: 'Khoa Công nghệ thông tin',
    },
  });
  console.log(`Đã tạo Khoa: ${faculty.name}`);

  const department = await prisma.department.upsert({
    where: { id: 'BM_KTPM' },
    update: {},
    create: {
      id: 'BM_KTPM',
      name: 'Bộ môn Kỹ thuật phần mềm',
      faculty_id: faculty.id,
    },
  });
  console.log(`Đã tạo Bộ môn: ${department.name}`);

  // Hash mật khẩu chung
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Tạo User Giảng viên
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@gmail.com' },
    update: {},
    create: {
      username: 'teacher',
      email: 'teacher@gmail.com',
      password_hash: hashedPassword,
      is_active: true,
      role_id: teacherRole.id,
      email_verified_at: new Date(),
      must_change_password: false,
    },
  });

  const teacher = await prisma.teacher.upsert({
      where: { user_id: teacherUser.id },
      update: {},
      create: {
        user: { connect: { id: teacherUser.id } },
        teacher_id: 'GV001',
        name: 'Nguyễn Văn A', 
        email: teacherUser.email, 
        department: { connect: { id: department.id } },
        faculty: { connect: { id: faculty.id } },
      },
    });
  console.log(`Đã tạo Giảng viên: ${teacher.name} (Email: ${teacherUser.email} / Mật khẩu: ${defaultPassword})`);

  // Tạo User Sinh viên 1
  const studentUser1 = await prisma.user.upsert({
    where: { email: 'student1@gmail.com' },
    update: {},
    create: {
      username: 'student1',
      email: 'student1@gmail.com',
      password_hash: hashedPassword,
      is_active: true,
      role_id: studentRole.id,
      email_verified_at: new Date(),
      must_change_password: false,
    },
  });

  const student1 = await prisma.student.upsert({
    where: { user_id: studentUser1.id },
    update: {},
    create: {
      user: { connect: { id: studentUser1.id } },
      student_id: 'SV001',
      last_name: 'Trần',
      middle_name: 'Văn',
      first_name: 'B',
      class_name: 'SE1501', 
      major: 'Kỹ thuật phần mềm',
      date_of_birth: new Date('2003-01-15'), 
      gender: Gender.MALE,
      course_year: 15,
      academic_year: '2021-2025',
    },
  });
  console.log(`Đã tạo Sinh viên 1: ${student1.last_name} ${student1.middle_name} ${student1.first_name} (ID: ${student1.id})`);

  // Tạo User Sinh viên 2
  const studentUser2 = await prisma.user.upsert({
    where: { email: 'student2@gmail.com' },
    update: {},
    create: {
      username: 'student2',
      email: 'student2@gmail.com',
      password_hash: hashedPassword,
      is_active: true,
      role_id: studentRole.id,
      email_verified_at: new Date(),
      must_change_password: false,
    },
  });

  const student2 = await prisma.student.upsert({
    where: { user_id: studentUser2.id },
    update: {},
    create: {
      user: { connect: { id: studentUser2.id } },
      student_id: 'SV002',
      last_name: 'Nguyễn',
      middle_name: 'Thị',
      first_name: 'C',
      class_name: 'SE1502',
      major: 'Kỹ thuật phần mềm',
      date_of_birth: new Date('2003-05-20'), 
      gender: Gender.FEMALE,
      course_year: 15,
      academic_year: '2021-2025',
    },
  });
  console.log(`Đã tạo Sinh viên 2: ${student2.last_name} ${student2.middle_name} ${student2.first_name} (ID: ${student2.id})`);

  // Tạo Đợt đăng ký mẫu
  const period = await prisma.registrationPeriod.upsert({
    where: { id: 1 },
    update: { status: RegistrationPeriodStatus.OPEN },
    create: {
      id: 1,
      name: 'Đợt Đăng ký KLTN Học kỳ 1 2025-2026',
      semester: '1',
      school_year: '2025-2026',
      start_date: new Date(),
      teacher_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 
      student_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
      default_quota: 5,
      status: RegistrationPeriodStatus.OPEN,
    },
  });
  console.log(`Đã tạo Đợt đăng ký mẫu: ${period.name} (ID: ${period.id})`);

  console.log('Nạp dữ liệu hoàn tất!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect(); 
  });