import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // The CLI (migrate, resolve) needs a direct connection: its advisory lock
  // leaks through a transaction-mode pooler such as Neon's "-pooler" host.
  // The app itself keeps using DATABASE_URL (see PrismaService).
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
