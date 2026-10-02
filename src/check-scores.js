const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const scores = await prisma.independent_scores.findMany({
    where: { project_id: { in: [2, 3] } }
  });
  console.log('Scores count:', scores.length);
}
check().finally(() => prisma.$disconnect());
