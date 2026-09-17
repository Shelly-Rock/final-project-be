import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Đang bắt đầu nạp dữ liệu (Seeding)...');

  const defaultPassword = '1111';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const now = new Date();

  // 2. Tạo Permissions
  const permissionData = [
    {
      name: 'role:read',
      description: 'Xem role',
      module: 'role',
      action: 'read',
    },
    {
      name: 'role:create',
      description: 'Tạo role',
      module: 'role',
      action: 'create',
    },
    {
      name: 'role:update',
      description: 'Cập nhật role',
      module: 'role',
      action: 'update',
    },
    {
      name: 'role:delete',
      description: 'Xóa role',
      module: 'role',
      action: 'delete',
    },
    {
      name: 'user:read',
      description: 'Xem user',
      module: 'user',
      action: 'read',
    },
    {
      name: 'user:create',
      description: 'Tạo user',
      module: 'user',
      action: 'create',
    },
    {
      name: 'user:update',
      description: 'Cập nhật user',
      module: 'user',
      action: 'update',
    },
    {
      name: 'user:delete',
      description: 'Xóa user',
      module: 'user',
      action: 'delete',
    },
    {
      name: 'student:read',
      description: 'Xem sinh viên',
      module: 'student',
      action: 'read',
    },
    {
      name: 'student:create',
      description: 'Tạo sinh viên',
      module: 'student',
      action: 'create',
    },
    {
      name: 'student:update',
      description: 'Cập nhật sinh viên',
      module: 'student',
      action: 'update',
    },
    {
      name: 'student:delete',
      description: 'Xóa sinh viên',
      module: 'student',
      action: 'delete',
    },
    {
      name: 'teacher:read',
      description: 'Xem giảng viên',
      module: 'teacher',
      action: 'read',
    },
    {
      name: 'teacher:create',
      description: 'Tạo giảng viên',
      module: 'teacher',
      action: 'create',
    },
    {
      name: 'teacher:update',
      description: 'Cập nhật giảng viên',
      module: 'teacher',
      action: 'update',
    },
    {
      name: 'teacher:delete',
      description: 'Xóa giảng viên',
      module: 'teacher',
      action: 'delete',
    },
    {
      name: 'notification:read',
      description: 'Xem thông báo',
      module: 'notification',
      action: 'read',
    },
    {
      name: 'notification:create',
      description: 'Tạo thông báo',
      module: 'notification',
      action: 'create',
    },
    {
      name: 'notification:send',
      description: 'Gửi thông báo đến người dùng',
      module: 'notification',
      action: 'send',
    },
    {
      name: 'notification:update',
      description: 'Cập nhật thông báo',
      module: 'notification',
      action: 'update',
    },
    {
      name: 'notification:delete',
      description: 'Xóa thông báo',
      module: 'notification',
      action: 'delete',
    },
  ];

  const permissions = [];
  for (const data of permissionData) {
    const permission = await prisma.permission.upsert({
      where: { name: data.name },
      update: data,
      create: data,
    });
    permissions.push(permission);
    console.log(
      `✅ Đã tạo Permission: ${permission.name} - ID: ${permission.id}`,
    );
  }

  // 3. Tạo 4 Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      display_name: 'Quản trị viên',
      description: 'Quyền truy cập đầy đủ hệ thống',
      is_system: true,
      priority: 4,
    },
  });
  console.log(`✅ Đã tạo Role: ${adminRole.name}`);

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
  console.log(`✅ Đã tạo Role: ${teacherRole.name}`);

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
  console.log(`✅ Đã tạo Role: ${studentRole.name}`);

  const secretaryRole = await prisma.role.upsert({
    where: { name: 'SECRETARY' },
    update: {},
    create: {
      name: 'SECRETARY',
      display_name: 'Thư ký',
      description: 'Quyền truy cập dành cho Thư ký',
      is_system: true,
      priority: 3,
    },
  });
  console.log(`✅ Đã tạo Role: ${secretaryRole.name}`);

  // 4. Gán permissions cho roles
  const rolePermissions: Record<string, string[]> = {
    ADMIN: permissionData.map((permission) => permission.name),
    SECRETARY: [
      'user:read',
      'user:create',
      'user:update',
      'student:read',
      'student:create',
      'student:update',
      'student:delete',
      'teacher:read',
      'notification:read',
      'notification:create',
      'notification:send',
    ],
    TEACHER: [
      'student:read',
      'notification:read',
      'notification:create',
      'notification:send',
    ],
    STUDENT: [
      'student:read',
      'notification:read',
    ],
  };

  // Grant default permissions for each role
  for (const role of [adminRole, teacherRole, studentRole, secretaryRole]) {
    for (const permission of permissions) {
      if (!rolePermissions[role.name]?.includes(permission.name)) continue;
      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: {
          role_id: role.id,
          permission_id: permission.id,
        },
      });
    }
  }
  console.log('✅ Đã gán permissions cho tất cả roles');

  // 5. Tạo Faculty và Department
  const faculty = await prisma.faculty.upsert({
    where: { id: 'KHOA_CNTT' },
    update: {},
    create: {
      id: 'KHOA_CNTT',
      name: 'Khoa Công nghệ thông tin',
    },
  });
  console.log(`✅ Đã tạo Khoa: ${faculty.name}`);

  const department = await prisma.department.upsert({
    where: { id: 'BM_KTPM' },
    update: {},
    create: {
      id: 'BM_KTPM',
      name: 'Bộ môn Kỹ thuật phần mềm',
      faculty_id: faculty.id,
    },
  });
  console.log(`✅ Đã tạo Bộ môn: ${department.name}`);

  // 6. Tạo 4 User Accounts với các Roles tương ứng
  const defaultUsers = [
    {
      email: 'admin@system.com',
      username: 'admin_sys',
      role: adminRole,
      firstName: 'Quản trị',
      lastName: 'Hệ Thống',
    },
    {
      email: 'teacher@system.com',
      username: 'teacher_demo',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Demo',
      teacherId: 'GV001',
    },
    {
      email: 'teacher2@system.com',
      username: 'teacher_demo_2',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Hai',
      teacherId: 'GV002',
    },
    {
      email: 'teacher3@system.com',
      username: 'teacher_demo_3',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Ba',
      teacherId: 'GV003',
    },
    {
      email: 'teacher4@system.com',
      username: 'teacher_demo_4',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Bốn',
      teacherId: 'GV004',
    },
    {
      email: 'teacher5@system.com',
      username: 'teacher_demo_5',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Năm',
      teacherId: 'GV005',
    },
    {
      email: 'teacher6@system.com',
      username: 'teacher_demo_6',
      role: teacherRole,
      firstName: 'Giảng viên',
      lastName: 'Sáu',
      teacherId: 'GV006',
    },
    {
      email: 'secretary@system.com',
      username: 'secretary_demo',
      role: secretaryRole,
      firstName: 'Thư ký',
      lastName: 'Hệ thống',
    },
    {
      email: 'student@system.com',
      username: 'student_demo',
      role: studentRole,
      firstName: 'Một',
      lastName: 'Sinh viên',
      studentId: 'SV001',
    },
    {
      email: 'student2@system.com',
      username: 'student_demo_2',
      role: studentRole,
      firstName: 'Hai',
      lastName: 'Sinh viên',
      studentId: 'SV002',
    },
    {
      email: 'student3@system.com',
      username: 'student_demo_3',
      role: studentRole,
      firstName: 'Ba',
      lastName: 'Sinh viên',
      studentId: 'SV003',
    },
    {
      email: 'student4@system.com',
      username: 'student_demo_4',
      role: studentRole,
      firstName: 'Bốn',
      lastName: 'Sinh viên',
      studentId: 'SV004',
    },
  ];

  for (const userData of defaultUsers) {
    // Tạo User
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password_hash: hashedPassword,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
      },
      create: {
        email: userData.email,
        username: userData.username,
        password_hash: hashedPassword,
        is_active: true,
        email_verified_at: now,
        must_change_password: false,
      },
    });

    // Gán Role cho User (Admin có tất cả 4 roles)
    const rolesToAssign = userData.role.name === 'ADMIN'
      ? [adminRole, secretaryRole, teacherRole, studentRole]
      : [userData.role];

    for (const role of rolesToAssign) {
      await prisma.userRole.upsert({
        where: {
          user_id_role_id: {
            user_id: user.id,
            role_id: role.id,
          },
        },
        update: {},
        create: {
          user_id: user.id,
          role_id: role.id,
        },
      });
    }

    if (userData.role.name === 'TEACHER' && userData.teacherId) {
      await prisma.teacher.upsert({
        where: { teacher_id: userData.teacherId },
        update: {
          user: { connect: { id: user.id } },
          name: `${userData.lastName} ${userData.firstName}`,
          email: userData.email,
          status: 'active',
          department: { connect: { id: department.id } },
          faculty: { connect: { id: faculty.id } },
        },
        create: {
          teacher_id: userData.teacherId,
          user: { connect: { id: user.id } },
          name: `${userData.lastName} ${userData.firstName}`,
          email: userData.email,
          status: 'active',
          department: { connect: { id: department.id } },
          faculty: { connect: { id: faculty.id } },
        },
      });
    }

    if (userData.role.name === 'STUDENT' && userData.studentId) {
      await prisma.student.upsert({
        where: { student_id: userData.studentId },
        update: {
          user: { connect: { id: user.id } },
          first_name: userData.firstName,
          middle_name: '',
          last_name: userData.lastName,
          email: userData.email,
          date_of_birth: new Date('2000-01-01'),
          gender: 'MALE',
          class_name: 'K10',
          major: 'KTPM',
          course_year: 10,
          academic_year: '2023-2024',
        },
        create: {
          student_id: userData.studentId,
          user: { connect: { id: user.id } },
          first_name: userData.firstName,
          middle_name: '',
          last_name: userData.lastName,
          email: userData.email,
          date_of_birth: new Date('2000-01-01'),
          gender: 'MALE',
          class_name: 'K10',
          major: 'KTPM',
          course_year: 10,
          academic_year: '2023-2024',
        },
      });
    }

    console.log(
      `✅ Đã tạo tài khoản (${userData.role.name}): ${user.email} | Username: ${user.username}`,
    );
  }

  // 7. Tạo Project DT001 (optional - may fail if student already has project)
  try {
    const studentDemo = await prisma.student.findUnique({ where: { student_id: 'SV001' } });
    const teacherDemo = await prisma.teacher.findUnique({ where: { teacher_id: 'GV001' } });

    if (studentDemo && teacherDemo) {
      const existingProject = await prisma.project.findUnique({
        where: { project_id: 'DT001' },
      });

      if (existingProject) {
        console.log(`✅ Đề tài DT001 đã tồn tại`);
      } else {
        const project = await prisma.project.create({
          data: {
            project_id: 'DT001',
            project_name: 'Hệ thống quản lý sinh viên',
            description: 'Phát triển hệ thống quản lý sinh viên bằng NextJS và NestJS',
            student_id: studentDemo.id,
            teacher_id: teacherDemo.id,
            status: 'APPROVED',
          },
        });
        console.log(`✅ Đã tạo Đề tài: ${project.project_id} - ${project.project_name}`);
      }
    }
  } catch (error) {
    console.log(`ℹ️  Bỏ qua tạo Đề tài DT001 (có thể sinh viên đã có dự án khác)`);
  }

  // 8. Tạo Sample Notifications
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@system.com' } });
  const teacherUser = await prisma.user.findUnique({ where: { email: 'teacher@system.com' } });
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@system.com' } });

  if (adminUser && teacherUser && studentUser) {
    await prisma.progress_notifications.createMany({
      data: [
        {
          type: 'STATUS_CHANGED',
          title: 'Thay đổi trạng thái đề tài',
          message: 'Đề tài của bạn đã được phê duyệt',
          recipient_id: studentUser.id,
          sender_id: adminUser.id,
          is_read: false,
        },
        {
          type: 'REPORT_SUBMITTED',
          title: 'Báo cáo tiến độ đã được nộp',
          message: 'Sinh viên vừa nộp báo cáo tiến độ hàng tháng',
          recipient_id: teacherUser.id,
          sender_id: studentUser.id,
          is_read: false,
        },
        {
          type: 'REPORT_APPROVED',
          title: 'Báo cáo được phê duyệt',
          message: 'Báo cáo tiến độ của bạn đã được giảng viên phê duyệt',
          recipient_id: studentUser.id,
          sender_id: teacherUser.id,
          is_read: true,
        },
        {
          type: 'BAN_WARNING',
          title: 'Cảnh báo: Sắp bị cấm nộp bài',
          message: 'Bạn đã quá hạn nộp báo cáo 3 lần. Cảnh báo cuối cùng trước khi bị cấm.',
          recipient_id: studentUser.id,
          sender_id: adminUser.id,
          is_read: false,
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Đã tạo Sample Notifications');
  }

  console.log('🎉 Seed dữ liệu mẫu hoàn tất!');
  console.log('🔑 Mật khẩu mặc định cho tất cả tài khoản là: 1111');
  console.log('✉️  Tất cả tài khoản đã được xác thực email (email_verified_at)');
  console.log('🔔 Thông báo mẫu đã được tạo cho các tài khoản demo');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Lỗi khi seed database:', e);
  process.exit(1);
});
