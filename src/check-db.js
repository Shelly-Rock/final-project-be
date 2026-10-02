const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.users.findUnique({
    where: { email: 'secretary@nttu.edu.vn' },
    include: {
      secretary: true,
      role_id_roleTouser: true,
    }
  });
  console.log('User:', user);
  
  if (user) {
    const proj1 = await prisma.project.findUnique({ where: { id: 2 } });
    const proj2 = await prisma.project.findUnique({ where: { id: 3 } });
    console.log('Project 2 faculty:', proj1?.faculty_id);
    console.log('Project 3 faculty:', proj2?.faculty_id);
    
    // Check committee_scores
    const cscores = await prisma.committee_scores.findMany({
      where: { project_id: { in: [2, 3] } }
    });
    console.log('Committee scores for 2 & 3:', cscores.length);
  }
}
check().finally(() => prisma.$disconnect());

