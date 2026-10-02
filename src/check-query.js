const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const scopedFacultyId = 'KHOA_CNTT';
  const projects = await prisma.project.findMany({
    where: {
      status: 'APPROVED',
      deleted_at: null,
      independent_scores: {
        some: {
          deleted_at: null,
        },
      },
      ...(scopedFacultyId
        ? { teacher: { faculty_id: scopedFacultyId } }
        : {}),
    },
    include: {
      teacher: { select: { faculty_id: true } },
    }
  });

  console.log('Projects length:', projects.length);
  console.log(projects.map(p => ({ id: p.id, code: p.project_id })));
}

check().finally(() => prisma.$disconnect());
