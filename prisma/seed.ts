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
    ],
    TEACHER: ['student:read'],
    STUDENT: ['student:read'],
  };

  // Only grant default permissions on first seed. Subsequent runs must NOT
  // wipe rolePermission rows that an admin has edited via the permission matrix.
  const existingGrantCount = await prisma.rolePermission.count();
  if (existingGrantCount === 0) {
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
  } else {
    console.log('ℹ️  Bỏ qua gán permissions (đã có dữ liệu phân quyền, giữ nguyên chỉnh sửa của admin)');
  }

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
      firstName: 'Demo',
      lastName: 'Sinh viên Trưởng',
      studentId: 'SV001',
    },
    {
      email: 'student2@system.com',
      username: 'student_demo_2',
      role: studentRole,
      firstName: 'Demo',
      lastName: 'Sinh viên Phụ',
      studentId: 'SV002',
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

  // 7. Tạo dữ liệu mô phỏng luồng đăng ký & upload báo cáo (Simulation)
  const studentLeader = await prisma.student.findUnique({ where: { student_id: 'SV001' } });
  const studentMember = await prisma.student.findUnique({ where: { student_id: 'SV002' } });
  const teacherDemo = await prisma.teacher.findUnique({ where: { teacher_id: 'GV001' } });
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin_sys' } });

  if (studentLeader && studentMember && teacherDemo && adminUser) {
    // Bước 7.1: Tạo Registration Period
    const period = await prisma.registration_periods.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Học kỳ 1 - Năm học 2024-2025',
        semester: 'HK1',
        school_year: '2024-2025',
        start_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        teacher_deadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        student_deadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        default_quota: 2,
        status: 'OPEN',
        updated_at: now,
      },
    });
    console.log(`✅ Đã tạo Đợt đăng ký: ${period.name}`);

    // Bước 7.2: Tạo Deadline Nộp báo cáo cuối kỳ
    await prisma.period_deadlines.upsert({
      where: {
        period_id_type_seq: {
          period_id: period.id,
          type: 'FINAL_SUBMISSION',
          seq: 1,
        }
      },
      update: {},
      create: {
        period_id: period.id,
        type: 'FINAL_SUBMISSION',
        seq: 1,
        label: 'Hạn cuối nộp báo cáo',
        deadline_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),  // closes in 14 days
        updated_at: now,
      },
    });

    // Bước 7.3: Tạo Topic thuộc Period
    const topic = await prisma.topics.upsert({
      where: { code: 'SE001' },
      update: { locked_at: now }, // Mô phỏng đã khóa
      create: {
        code: 'SE001',
        name: 'Xây dựng hệ thống quản lý đồ án',
        description: 'Phát triển hệ thống bằng NextJS, NestJS, Prisma',
        max_students: 2,
        registered_students: 2,
        teacher_id: teacherDemo.id,
        period_id: period.id,
        status: 'APPROVED',
        locked_at: now, // Mô phỏng GV đã khóa
        updated_at: now,
      },
    });
    console.log(`✅ Đã tạo Đề tài: ${topic.code} - ${topic.name}`);

    // Bước 7.4: Tạo Project cho SV001 (Trưởng nhóm) và SV002 (Thành viên)
    const projectId1 = `DA-${topic.code}-${studentLeader.student_id}`;
    await prisma.project.upsert({
      where: { student_id: studentLeader.id },
      update: { 
        project_id: projectId1,
        topic_id: topic.id,
        project_name: topic.name,
        status: 'APPROVED', 
        is_leader: true, 
        assigned_task: 'Thiết kế BE & Quản lý nhóm',
        updated_at: now 
      },
      create: {
        project_id: projectId1,
        project_name: topic.name,
        description: topic.description,
        topic_id: topic.id,
        student_id: studentLeader.id,
        teacher_id: teacherDemo.id,
        status: 'APPROVED',
        is_leader: true,
        assigned_task: 'Thiết kế BE & Quản lý nhóm',
        updated_at: now,
      },
    });

    const projectId2 = `DA-${topic.code}-${studentMember.student_id}`;
    await prisma.project.upsert({
      where: { student_id: studentMember.id },
      update: { 
        project_id: projectId2,
        topic_id: topic.id,
        project_name: topic.name,
        status: 'APPROVED', 
        is_leader: false, 
        assigned_task: 'Làm FE UI',
        updated_at: now 
      },
      create: {
        project_id: projectId2,
        project_name: topic.name,
        description: topic.description,
        topic_id: topic.id,
        student_id: studentMember.id,
        teacher_id: teacherDemo.id,
        status: 'APPROVED',
        is_leader: false,
        assigned_task: 'Làm FE UI',
        updated_at: now,
      },
    });
    console.log(`✅ Đã phân công 2 sinh viên vào Đề tài (SV001 là Trưởng nhóm)`);

    // Bước 7.5: Tạo Student Progress để vượt qua bài check điều kiện nộp bài
    for (const s of [studentLeader, studentMember]) {
      await prisma.student_progress.upsert({
        where: { student_id: s.id },
        update: { status: 'ON_TRACK', is_banned: false },
        create: {
          student_id: s.id,
          total_reports_required: 4,
          total_reports_submitted: 4,
          is_banned: false,
          status: 'ON_TRACK',
          updated_at: now,
        },
      });
    }
    console.log(`✅ Đã khởi tạo tiến độ (Student Progress) cho 2 sinh viên`);
  }

  console.log('🎉 Seed dữ liệu mẫu hoàn tất!');
  console.log('🔑 Mật khẩu mặc định cho tất cả tài khoản là: 1111');
  console.log('✉️  Tất cả tài khoản đã được xác thực email (email_verified_at)');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Lỗi khi seed database:', e);
  process.exit(1);
});
