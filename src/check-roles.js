const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'secretary@nttu.edu.vn' },
    include: {
      user_roles: {
        include: { role: true }
      }
    }
  });
  console.log('Roles:', user.user_roles.map(ur => ur.role.name));
}
check().finally(() => prisma.$disconnect());
