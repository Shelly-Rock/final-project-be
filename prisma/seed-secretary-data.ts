import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSecretaryData() {
  console.log('🌱 Nạp dữ liệu cho Secretary Department Dashboard...');

  try {
    // 1. Lấy Department và Teachers
    const department = await prisma.department.findUnique({
      where: { id: 'BM_KTPM' },
    });

    if (!department) {
      throw new Error('Department BM_KTPM not found');
    }
    console.log('✅ Found Department:', department.name);

    // 2. Lấy 6 teachers từ department
    const teachers = await prisma.teacher.findMany({
      where: { department_id: department.id },
      take: 6,
    });

    if (teachers.length === 0) {
      throw new Error('No teachers found in department');
    }
    console.log(`✅ Found ${teachers.length} teachers`);

    // 3. Lấy hoặc tạo registration period
    let period = await prisma.registration_periods.findFirst({
      where: {
        school_year: '2024-2025',
      },
    });

    if (!period) {
      period = await prisma.registration_periods.create({
        data: {
          name: 'Học kỳ 1 (2024-2025)',
          semester: '1',
          school_year: '2024-2025',
          start_date: new Date('2024-09-01'),
          teacher_deadline: new Date('2024-09-15'),
          student_deadline: new Date('2024-09-20'),
          default_quota: 5,
          status: 'UPCOMING',
          updated_at: new Date(),
        },
      });
      console.log('✅ Created registration period');
    } else {
      console.log('✅ Using existing registration period');
    }

    // 4. Delete existing topics and create new ones
    await prisma.topics.deleteMany({
      where: { code: { in: ['DT-2024-KTPM01', 'DT-2024-KTPM02'] } },
    });

    const topic1 = await prisma.topics.create({
      data: {
        name: 'Hệ thống Quản lý Đào tạo & NCKH',
        code: 'DT-2024-KTPM01',
        description:
          'Phát triển hệ thống quản lý toàn diện cho đào tạo và nghiên cứu khoa học',
        teacher_id: teachers[0].id,
        period_id: period.id,
        max_students: 5,
        registered_students: 1,
        status: 'APPROVED',
        created_at: new Date('2024-01-15'),
        updated_at: new Date('2024-01-20'),
      },
    });
    console.log('✅ Created Topic 1:', topic1.name);

    const topic2 = await prisma.topics.create({
      data: {
        name: 'Ứng dụng AI phân tích kết quả học tập',
        code: 'DT-2024-KTPM02',
        description:
          'Xây dựng ứng dụng sử dụng AI để phân tích và dự đoán kết quả học tập của sinh viên',
        teacher_id: teachers[1].id,
        period_id: period.id,
        max_students: 4,
        registered_students: 0,
        status: 'APPROVED',
        created_at: new Date('2024-01-16'),
        updated_at: new Date('2024-01-21'),
      },
    });
    console.log('✅ Created Topic 2:', topic2.name);

    // 5. Get student for progress reports
    const student = await prisma.student.findUnique({
      where: { student_id: 'SV001' },
    });

    if (student) {
      // Delete existing reports for this student
      await prisma.progress_reports.deleteMany({
        where: { student_id: student.id },
      });

      // Create progress reports for 3 months × 3 teachers
      let reportCount = 0;
      for (let month = 1; month <= 3; month++) {
        for (let i = 0; i < Math.min(3, teachers.length); i++) {
          const teacher = teachers[i];
          const status =
            month === 1 ? 'APPROVED' : month === 2 ? 'PENDING' : 'APPROVED';

          await prisma.progress_reports.create({
            data: {
              title: `Báo cáo tiến độ tháng ${month}`,
              content: `Nội dung báo cáo chi tiết cho tháng ${month} năm 2024. Tiến độ dự án đạt 85% hoàn thành.`,
              month,
              year: 2024,
              teacher_id: teacher.id,
              student_id: student.id,
              status: status as any,
              score: month === 1 ? 9 : month === 2 ? undefined : 8,
              feedback:
                month === 2 ? 'Đang chờ xem xét' : 'Báo cáo chi tiết và đầy đủ',
              updated_at: new Date(),
            },
          });
          reportCount++;
        }
      }
      console.log(`✅ Created ${reportCount} progress reports for 3 months`);
    } else {
      console.log('⚠️  Student SV001 not found, skipping progress reports');
    }

    console.log('🎉 Secretary dashboard seed data completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Department: ${department.name}`);
    console.log(`   - Teachers: ${teachers.length}`);
    console.log(`   - Topics: 2 (both APPROVED)`);
    console.log(`   - Progress Reports: ${student ? '9 (3 months × 3 teachers)' : '0'}`);
    console.log(
      '\n📝 Test Credentials:',
    );
    console.log(`   Email: secretary@system.com`);
    console.log(`   Password: 1111`);
    console.log(
      '\n🔗 Test URL: https://final-project-fe-orpin.vercel.app/department/BM_KTPM',
    );
  } catch (error) {
    console.error('❌ Error seeding secretary data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedSecretaryData().catch((error) => {
  console.error(error);
  process.exit(1);
});
