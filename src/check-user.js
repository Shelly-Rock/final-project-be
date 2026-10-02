const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: { email: 'secretary@nttu.edu.vn' }
  });
  console.log(users);
}
check().finally(() => prisma.$disconnect());
