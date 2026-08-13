import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_MR_PERMISSIONS,
} from '../src/constants/permissions';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const rows: { role: 'ADMIN' | 'MANAGER' | 'MR'; permission: string }[] = [
    ...DEFAULT_ADMIN_PERMISSIONS.map((permission) => ({ role: 'ADMIN' as const, permission })),
    ...DEFAULT_MANAGER_PERMISSIONS.map((permission) => ({
      role: 'MANAGER' as const,
      permission,
    })),
    ...DEFAULT_MR_PERMISSIONS.map((permission) => ({ role: 'MR' as const, permission })),
  ];

  for (const row of rows) {
    await prisma.rolePermission.upsert({
      where: { role_permission: { role: row.role, permission: row.permission } },
      create: row,
      update: {},
    });
  }

  console.log(`Seeded ${rows.length} role permissions`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
