const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projects = await prisma.project.findMany({
    where: { id: { in: [2, 3] } },
    include: { teacher: true }
  });
  console.log(projects.map(p => ({
    id: p.id,
    teacher: p.teacher.name,
    teacherFaculty: p.teacher.faculty_id
  })));
}
check().finally(() => prisma.$disconnect());
