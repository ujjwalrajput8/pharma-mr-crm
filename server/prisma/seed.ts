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
 * Bootstrap seed — safe to run on every deploy.
 *
 * It only writes the role default permissions and the Admin login. Everything
 * else is either created from the UI (users, doctors, chemists, products, leave
 * types, holidays…) or has a built-in fallback:
 *   - Attendance settings fall back to the defaults in `AttendanceService`
 *   - The default warehouse is ensured on server boot (`StockLedgerService`)
 *
 * Never add demo rows here: this script runs against production.
 */

/**
 * Makes `role_permissions` match `constants/permissions` exactly: keys added in
 * code are inserted, keys removed from code are deleted. Nothing in the app
 * writes this table — per-manager overrides live in `user_permissions` and are
 * not touched here.
 */
async function seedRolePermissions(prisma: PrismaClient): Promise<void> {
  const defaults: Record<'ADMIN' | 'MANAGER' | 'MR', readonly string[]> = {
    ADMIN: DEFAULT_ADMIN_PERMISSIONS,
    MANAGER: DEFAULT_MANAGER_PERMISSIONS,
    MR: DEFAULT_MR_PERMISSIONS,
  };

  for (const [role, permissions] of Object.entries(defaults) as Array<
    ['ADMIN' | 'MANAGER' | 'MR', readonly string[]]
  >) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission },
        update: {},
      });
    }

    const removed = await prisma.rolePermission.deleteMany({
      where: { role, permission: { notIn: [...permissions] } },
    });

    console.log(
      `  ${role}: ${permissions.length} permissions${removed.count ? `, ${removed.count} removed` : ''}`,
    );
  }
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

  console.log(`  Admin: ${admin.email}`);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Bootstrap seed — permissions and admin…');
    await seedRolePermissions(prisma);
    await seedAdmin(prisma);
    console.log('Seed complete. No other data was created.');
    console.log('Next: create Manager/MR accounts, leave types and holidays from the UI.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
