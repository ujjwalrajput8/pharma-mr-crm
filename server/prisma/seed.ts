import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Seed
 * Creates the default Admin account (no public registration).
 * Idempotent: skips if admin email already exists.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.ADMIN_EMAIL ?? 'admin@pharma-mr.local';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
  const fullName = process.env.ADMIN_NAME ?? 'System Admin';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  try {
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (existing) {
      console.log(`Admin already exists: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);

    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log(`Seeded Admin user: ${admin.email} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
