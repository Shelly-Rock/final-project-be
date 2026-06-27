import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await prisma.registration.deleteMany();
  await prisma.thesisTopic.deleteMany();
  await prisma.deadlineSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.class.deleteMany();
  await prisma.course.deleteMany();
  await prisma.major.deleteMany();
  await prisma.department.deleteMany();

  const password = await bcrypt.hash('123456', 10);

  // ============== DEPARTMENTS ==============
  const deptKHTN = await prisma.department.create({
    data: { code: 'KHTN', name: 'Khoa Học Tự Nhiên' },
  });

  const deptKHXH = await prisma.department.create({
    data: { code: 'KHXH', name: 'Khoa Học Xã Hội' },
  });

  const deptKT = await prisma.department.create({
    data: { code: 'KT', name: 'Kinh Tế' },
  });

  console.log('Departments created');

  // ============== MAJORS ==============
  const majorCNTT = await prisma.major.create({
    data: { code: 'CNTT', name: 'Công nghệ thông tin', departmentId: deptKHTN.id },
  });

  const majorKHMT = await prisma.major.create({
    data: { code: 'KHMT', name: 'Khoa học máy tính', departmentId: deptKHTN.id },
  });

  const majorQTKD = await prisma.major.create({
    data: { code: 'QTKD', name: 'Quản trị kinh doanh', departmentId: deptKT.id },
  });

  console.log('Majors created');

  // ============== COURSES ==============
  const course2024 = await prisma.course.create({
    data: { code: 'K2024', name: 'Khóa 2024', year: 2024 },
  });

  const course2023 = await prisma.course.create({
    data: { code: 'K2023', name: 'Khóa 2023', year: 2023 },
  });

  console.log('Courses created');

  // ============== CLASSES ==============
  const class1 = await prisma.class.create({
    data: {
      code: 'CNTT-K2024-01',
      name: 'CNTT K2024.01',
      majorId: majorCNTT.id,
      courseId: course2024.id,
    },
  });

  const class2 = await prisma.class.create({
    data: {
      code: 'CNTT-K2024-02',
      name: 'CNTT K2024.02',
      majorId: majorCNTT.id,
      courseId: course2024.id,
    },
  });

  const class3 = await prisma.class.create({
    data: {
      code: 'KHMT-K2024-01',
      name: 'KHMT K2024.01',
      majorId: majorKHMT.id,
      courseId: course2024.id,
    },
  });

  console.log('Classes created');

  // ============== USERS ==============

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@qnq.edu.vn',
      password,
      name: 'Nguyễn Văn Admin',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // Secretary
  const secretary = await prisma.user.create({
    data: {
      email: 'secretary@qnq.edu.vn',
      password,
      name: 'Trần Thị Thư Ký',
      role: Role.SECRETARY,
      departmentId: deptKHTN.id,
      isActive: true,
    },
  });

  // Teachers
  const teacher1 = await prisma.user.create({
    data: {
      email: 'teacher@qnq.edu.vn',
      password,
      name: 'PGS.TS. Lê Văn Giảng',
      role: Role.TEACHER,
      departmentId: deptKHTN.id,
      isActive: true,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: 'teacher2@qnq.edu.vn',
      password,
      name: 'TS. Hoàng Minh Trí',
      role: Role.TEACHER,
      departmentId: deptKHTN.id,
      isActive: true,
    },
  });

  const teacher3 = await prisma.user.create({
    data: {
      email: 'teacher3@qnq.edu.vn',
      password,
      name: 'ThS. Phạm Thu Hà',
      role: Role.TEACHER,
      departmentId: deptKHTN.id,
      isActive: true,
    },
  });

  console.log('Teachers created');

  // Students
  const student1 = await prisma.user.create({
    data: {
      email: 'student@qnq.edu.vn',
      password,
      name: 'Nguyễn Văn Sinh Viên',
      mssv: '20240001',
      role: Role.STUDENT,
      departmentId: deptKHTN.id,
      majorId: majorCNTT.id,
      classId: class1.id,
      isActive: true,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@qnq.edu.vn',
      password,
      name: 'Trần Thị B',
      mssv: '20240002',
      role: Role.STUDENT,
      departmentId: deptKHTN.id,
      majorId: majorCNTT.id,
      classId: class1.id,
      isActive: true,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: 'student3@qnq.edu.vn',
      password,
      name: 'Lê Văn C',
      mssv: '20240003',
      role: Role.STUDENT,
      departmentId: deptKHTN.id,
      majorId: majorCNTT.id,
      classId: class2.id,
      isActive: true,
    },
  });

  console.log('Students created');

  // ============== DEADLINE SETTINGS ==============
  await prisma.deadlineSetting.create({
    data: {
      name: 'Đăng ký đề tài HK2 2024-2025',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-06-30'),
      warningDays: 7,
      isActive: true,
    },
  });

  console.log('Deadline settings created');

  // ============== THESIS TOPICS ==============
  const topic1 = await prisma.thesisTopic.create({
    data: {
      code: 'DT-0001',
      title: 'Nghiên cứu và ứng dụng trí tuệ nhân tạo trong giáo dục đại học',
      description: 'Khảo sát việc ứng dụng AI trong giảng dạy và học tập tại các trường đại học Việt Nam',
      requirements: 'Sinh viên năm 3 trở lên, có kiến thức cơ bản về ML',
      maxStudents: 2,
      minGpa: 7.5,
      isMultipleOrder: true,
      deadline: new Date('2025-06-30'),
      status: 'APPROVED',
      supervisorId: teacher1.id,
    },
  });

  const topic2 = await prisma.thesisTopic.create({
    data: {
      code: 'DT-0002',
      title: 'Phát triển ứng dụng web với công nghệ React và Node.js',
      description: 'Xây dựng một ứng dụng web hoàn chỉnh sử dụng MERN stack',
      requirements: 'Sinh viên đã học môn Lập trình Web',
      maxStudents: 3,
      status: 'APPROVED',
      deadline: new Date('2025-06-30'),
      supervisorId: teacher2.id,
    },
  });

  const topic3 = await prisma.thesisTopic.create({
    data: {
      code: 'DT-0003',
      title: 'An ninh mạng và bảo mật dữ liệu trong hệ thống IoT',
      description: 'Nghiên cứu các phương pháp bảo mật cho hệ thống IoT',
      requirements: 'Sinh viên năm 4, đã học môn An toàn mạng',
      maxStudents: 1,
      minGpa: 8.0,
      status: 'PENDING_APPROVAL',
      supervisorId: teacher1.id,
    },
  });

  const topic4 = await prisma.thesisTopic.create({
    data: {
      code: 'DT-0004',
      title: 'Ứng dụng Blockchain trong quản lý chuỗi cung ứng',
      description: 'Thiết kế và triển khai hệ thống quản lý chuỗi cung ứng dựa trên Blockchain',
      requirements: 'Sinh viên có kiến thức về Blockchain',
      maxStudents: 2,
      status: 'APPROVED',
      deadline: new Date('2025-06-30'),
      supervisorId: teacher3.id,
    },
  });

  console.log('Thesis topics created');

  // ============== REGISTRATIONS ==============
  await prisma.registration.create({
    data: {
      studentId: student1.id,
      topicId: topic1.id,
      orderChoice: 1,
      status: 'PENDING',
    },
  });

  await prisma.registration.create({
    data: {
      studentId: student2.id,
      topicId: topic2.id,
      orderChoice: 1,
      status: 'PENDING',
    },
  });

  await prisma.registration.create({
    data: {
      studentId: student1.id,
      topicId: topic4.id,
      orderChoice: 2,
      status: 'PENDING',
    },
  });

  console.log('Registrations created');

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Test accounts:');
  console.log('─────────────────────────────────');
  console.log('| Role       | Email                    | Password |');
  console.log('─────────────────────────────────────────────────');
  console.log('| Admin      | admin@qnq.edu.vn         | 123456   |');
  console.log('| Secretary  | secretary@qnq.edu.vn     | 123456   |');
  console.log('| Teacher    | teacher@qnq.edu.vn       | 123456   |');
  console.log('| Teacher 2  | teacher2@qnq.edu.vn      | 123456   |');
  console.log('| Teacher 3  | teacher3@qnq.edu.vn     | 123456   |');
  console.log('| Student    | student@qnq.edu.vn       | 123456   |');
  console.log('| Student 2  | student2@qnq.edu.vn      | 123456   |');
  console.log('| Student 3  | student3@qnq.edu.vn      | 123456   |');
  console.log('─────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
