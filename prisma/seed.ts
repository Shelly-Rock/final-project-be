import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const sampleTeachers = [
  { teacherId: 'GVTEST001', email: 'gvtest001@example.com', name: 'Nguyen Van An' },
  { teacherId: 'GVTEST002', email: 'gvtest002@example.com', name: 'Tran Thi Binh' },
  { teacherId: 'GVTEST003', email: 'gvtest003@example.com', name: 'Le Quoc Cuong' },
  { teacherId: 'GVTEST004', email: 'gvtest004@example.com', name: 'Pham Thu Dung' },
  { teacherId: 'GVTEST005', email: 'gvtest005@example.com', name: 'Hoang Minh Duc' },
];
const sampleStudents = [
  {
    studentId: '2200001234',
    email: 'minhan01@nttu.edu.vn',
    firstName: 'An',
    middleName: 'Minh',
    lastName: 'Nguyen',
    className: 'CNTT01',
    major: 'Cong nghe thong tin',
    courseYear: 2024,
    academicYear: '2024-2028',
  },
  {
    studentId: '2200001235',
    email: 'giabinh02@nttu.edu.vn',
    firstName: 'Binh',
    middleName: 'Gia',
    lastName: 'Tran',
    className: 'CNTT01',
    major: 'Cong nghe thong tin',
    courseYear: 2024,
    academicYear: '2024-2028',
  },
  {
    studentId: '2200001236',
    email: 'ngocchi03@nttu.edu.vn',
    firstName: 'Chi',
    middleName: 'Ngoc',
    lastName: 'Le',
    className: 'CNTT02',
    major: 'Cong nghe thong tin',
    courseYear: 2024,
    academicYear: '2024-2028',
  },
];

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash('1111', 10);

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      display_name: 'Sinh vien',
      description: 'Quyen truy cap danh cho sinh vien',
      is_system: true,
      priority: 1,
    },
  });

  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: {
      name: 'TEACHER',
      display_name: 'Giang vien',
      description: 'Quyen truy cap danh cho giang vien',
      is_system: true,
      priority: 2,
    },
  });
  const studentPermissions = [
    {
      name: 'student:read',
      description: 'Xem thong tin sinh vien',
      module: 'student',
      action: 'read',
    },
    {
      name: 'notification:read',
      description: 'Xem thong bao',
      module: 'notification',
      action: 'read',
    },
  ];

  for (const permissionData of studentPermissions) {
    const permission = await prisma.permission.upsert({
      where: { name: permissionData.name },
      update: permissionData,
      create: permissionData,
    });

    await prisma.rolePermission.upsert({
      where: {
        role_id_permission_id: {
          role_id: studentRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: studentRole.id,
        permission_id: permission.id,
      },
    });
  }

  const teacherPermissions = [
    ...studentPermissions,
    {
      name: 'notification:create',
      description: 'Tao thong bao',
      module: 'notification',
      action: 'create',
    },
    {
      name: 'notification:send',
      description: 'Gui thong bao',
      module: 'notification',
      action: 'send',
    },
  ];

  for (const permissionData of teacherPermissions) {
    const permission = await prisma.permission.upsert({
      where: { name: permissionData.name },
      update: permissionData,
      create: permissionData,
    });

    await prisma.rolePermission.upsert({
      where: {
        role_id_permission_id: {
          role_id: teacherRole.id,
          permission_id: permission.id,
        },
      },
      update: {},
      create: {
        role_id: teacherRole.id,
        permission_id: permission.id,
      },
    });
  }
  const faculty = await prisma.faculty.upsert({
    where: { id: 'KHOA_CNTT' },
    update: {},
    create: {
      id: 'KHOA_CNTT',
      name: 'Khoa C\u00f4ng ngh\u1ec7 th\u00f4ng tin',
    },
  });

  for (const student of sampleStudents) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {
        password_hash: passwordHash,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
        deleted_at: null,
      },
      create: {
        email: student.email,
        username: student.studentId,
        password_hash: passwordHash,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
      },
    });

    await prisma.userRole.upsert({
      where: {
        user_id_role_id: {
          user_id: user.id,
          role_id: studentRole.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        role_id: studentRole.id,
      },
    });

    await prisma.student.upsert({
      where: { student_id: student.studentId },
      update: {
        user_id: user.id,
        email: student.email,
        first_name: student.firstName,
        middle_name: student.middleName,
        last_name: student.lastName,
        class_name: student.className,
        major: student.major,
        course_year: student.courseYear,
        academic_year: student.academicYear,
        faculty_id: faculty.id,
        deleted_at: null,
      },
      create: {
        student_id: student.studentId,
        email: student.email,
        first_name: student.firstName,
        middle_name: student.middleName,
        last_name: student.lastName,
        class_name: student.className,
        major: student.major,
        course_year: student.courseYear,
        academic_year: student.academicYear,
        faculty_id: faculty.id,
        user_id: user.id,
      },
    });
  }

  for (const teacher of sampleTeachers) {
    const user = await prisma.user.upsert({
      where: { email: teacher.email },
      update: {
        password_hash: passwordHash,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
        deleted_at: null,
      },
      create: {
        email: teacher.email,
        username: teacher.teacherId,
        password_hash: passwordHash,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
      },
    });

    await prisma.userRole.upsert({
      where: {
        user_id_role_id: { user_id: user.id, role_id: teacherRole.id },
      },
      update: {},
      create: { user_id: user.id, role_id: teacherRole.id },
    });

    await prisma.teacher.upsert({
      where: { teacher_id: teacher.teacherId },
      update: {
        user_id: user.id,
        email: teacher.email,
        name: teacher.name,
        position: 'Giang vien',
        faculty_id: faculty.id,
        status: 'active',
        deleted_at: null,
      },
      create: {
        user_id: user.id,
        teacher_id: teacher.teacherId,
        email: teacher.email,
        name: teacher.name,
        position: 'Giang vien',
        faculty_id: faculty.id,
        status: 'active',
      },
    });
  }
  console.log('Seeded 3 CNTT students and 5 CNTT teachers. Login password: 1111');
}

main()
  .catch((error) => {
    console.error('Failed to seed CNTT student accounts:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
