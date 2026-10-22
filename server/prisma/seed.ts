import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Bootstrap seed — safe to run on every deploy.
 *
 * It only creates the Admin login. Everything else is either created from the
 * UI (users, doctors, chemists, products, leave types, holidays…) or has a
 * built-in fallback:
 *   - Role permissions fall back to the defaults in `constants/permissions`
 *   - Attendance settings fall back to the defaults in `AttendanceService`
 *   - The default warehouse is ensured on server boot (`StockLedgerService`)
 *
 * Never add demo rows here: this script runs against production.
 */

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
    console.log('Bootstrap seed — admin only…');
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
