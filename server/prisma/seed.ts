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
 * It only writes what the application cannot boot without:
 *   1. Role default permissions
 *   2. The Admin login
 *   3. Attendance / leave config key-values
 *   4. One warehouse + the `stock.default_warehouse_id` setting
 *      (without it the Stock and Products screens fail outright)
 *
 * It deliberately creates NO business data — no doctors, chemists, products,
 * appointments, visits, attendance, sales, leave types or holidays. Those are
 * customer data and are created from the UI. Never add demo rows here: this
 * script runs against production.
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

  console.log(`  Admin: ${admin.email}`);
}

/** Config the app reads at runtime. Existing values are never overwritten. */
async function seedSettings(prisma: PrismaClient): Promise<void> {
  const defaults = [
    { key: 'attendance.shiftStart', value: '09:30', group: 'attendance' },
    { key: 'attendance.lateGraceMinutes', value: '15', group: 'attendance' },
    { key: 'attendance.minGpsAccuracyM', value: '150', group: 'attendance' },
    { key: 'leave.weeklyOffDay', value: '0', group: 'leave' },
  ];

  let created = 0;
  for (const item of defaults) {
    const existing = await prisma.setting.findFirst({ where: { key: item.key } });
    if (existing) continue;
    await prisma.setting.create({ data: item });
    created += 1;
  }

  console.log(`  Settings: ${created} created, ${defaults.length - created} already present`);
}

/**
 * The stock screens resolve every quantity against a default warehouse. Without
 * the warehouse row *and* the `stock.default_warehouse_id` setting, Stock Balances
 * and Products both fail — so a fresh install gets one main warehouse.
 */
async function seedDefaultWarehouse(prisma: PrismaClient): Promise<void> {
  const setting = await prisma.setting.findFirst({
    where: { key: 'stock.default_warehouse_id' },
  });

  if (setting) {
    const existing = await prisma.warehouse.findFirst({
      where: { id: Number(setting.value), deletedAt: null },
    });
    if (existing) {
      console.log(`  Default warehouse already set (#${existing.id} ${existing.code})`);
      return;
    }
  }

  const warehouse =
    (await prisma.warehouse.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } })) ??
    (await prisma.warehouse.create({
      data: { name: 'Main Warehouse', code: 'MAIN', status: 'ACTIVE' },
    }));

  await prisma.setting.upsert({
    where: { key: 'stock.default_warehouse_id' },
    create: {
      key: 'stock.default_warehouse_id',
      value: String(warehouse.id),
      group: 'stock',
    },
    update: { value: String(warehouse.id), group: 'stock', deletedAt: null },
  });

  console.log(`  Default warehouse: #${warehouse.id} ${warehouse.code}`);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Bootstrap seed — permissions, admin and config only…');
    await seedRolePermissions(prisma);
    await seedAdmin(prisma);
    await seedSettings(prisma);
    await seedDefaultWarehouse(prisma);
    console.log('Seed complete. No business data was created.');
    console.log('Next: create Manager/MR accounts, leave types and holidays from the UI.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
