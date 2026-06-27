import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: 'postgresql://postgres:postgres@localhost:5432/be_db?schema=public&connection_limit=1',
  },
});
