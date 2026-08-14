import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_MR_PERMISSIONS,
} from '../src/constants/permissions';

/**
 * Production-safe seed — only:
 *  1. Role default permissions (every run)
 *  2. Admin user upsert (every run)
 *
 * Does NOT truncate or create demo managers / MRs / masters.
 */

async function seedRolePermissions(prisma: PrismaClient): Promise<void> {
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

  console.log(`  Role permissions upserted (${rows.length})`);
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const email = process.env.ADMIN_EMAIL ?? 'admin@pharma-mr.local';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
  const fullName = process.env.ADMIN_NAME ?? 'System Admin';
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    update: {
      passwordHash,
      fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      deletedAt: null,
    },
  });

  console.log(`  Admin: ${admin.email} / ${password}`);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Seeding admin + role permissions…');
    await seedRolePermissions(prisma);
    await seedAdmin(prisma);
    console.log('Seed complete (data tables left untouched).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
