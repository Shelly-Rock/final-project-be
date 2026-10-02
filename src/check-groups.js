const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const groups = await prisma.project.groupBy({
    by: ['topic_id'],
    _count: {
      id: true
    },
    having: {
      id: {
        _count: {
          gt: 1
        }
      }
    }
  });
  console.log(groups);
}
check().finally(() => prisma.$disconnect());
