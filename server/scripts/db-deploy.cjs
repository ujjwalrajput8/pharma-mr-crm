#!/usr/bin/env node
/**
 * Deploy-time database step: baseline (once) → migrate → seed.
 *
 * Why this exists
 * ---------------
 * This database was originally created with `prisma db push`, so it has all the
 * tables but no `_prisma_migrations` history. Plain `prisma migrate deploy` then
 * refuses to run:
 *
 *     Error: P3005 — The database schema is not empty.
 *
 * That is exactly what breaks a deploy: the new code expects columns like
 * `mr_profiles.designation`, the migration never runs, and every authenticated
 * request 500s with "column does not exist".
 *
 * So before migrating we baseline: for each migration whose objects are already
 * in the database, record it as applied without re-running its SQL. After that
 * `migrate deploy` applies only what is genuinely pending, and every later
 * deploy is a plain no-op.
 *
 * Safe to run repeatedly. Never drops or rewrites data.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const serverDir = path.resolve(__dirname, '..');
const req = createRequire(path.join(serverDir, 'package.json'));
const { Client } = req('pg');

/**
 * A migration is "already applied" if this object exists.
 * New migrations need no entry here — with no sentinel they are treated as
 * pending, which is the safe default.
 */
const SENTINELS = {
  '20260814120000_init': 'public.users',
  '20260903120000_leave_holiday_hr': 'public.leave_types',
};

function log(message) {
  console.log(`[db-deploy] ${message}`);
}

function runPrisma(args) {
  execFileSync('npx', ['prisma', ...args], {
    cwd: serverDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function listMigrations() {
  const dir = path.join(serverDir, 'prisma', 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function baselineIfNeeded(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_history,
              to_regclass('public.users')              IS NOT NULL AS has_schema`,
    );
    const { has_history: hasHistory, has_schema: hasSchema } = rows[0];

    if (hasHistory) {
      log('migration history present — nothing to baseline');
      return;
    }

    if (!hasSchema) {
      log('empty database — migrate deploy will create everything');
      return;
    }

    log('schema exists but migration history is missing → baselining');

    const applied = [];
    for (const migration of listMigrations()) {
      const sentinel = SENTINELS[migration];
      if (!sentinel) {
        log(`  ${migration}: no sentinel → treated as pending`);
        continue;
      }
      const check = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [
        sentinel,
      ]);
      if (check.rows[0].present) {
        applied.push(migration);
        log(`  ${migration}: ${sentinel} already exists → mark applied`);
      } else {
        log(`  ${migration}: ${sentinel} missing → pending`);
      }
    }

    // `migrate resolve` creates _prisma_migrations on first use.
    for (const migration of applied) {
      runPrisma(['migrate', 'resolve', '--applied', migration]);
    }

    if (applied.length === 0) {
      log('nothing matched a sentinel — leaving history to migrate deploy');
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  log(`target: ${new URL(connectionString).hostname}`);

  await baselineIfNeeded(connectionString);

  log('applying pending migrations');
  runPrisma(['migrate', 'deploy']);

  log('running bootstrap seed');
  runPrisma(['db', 'seed']);

  log('database ready');
}

main().catch((error) => {
  console.error('[db-deploy] FAILED —', error.message);
  // Exit non-zero so the deploy stops instead of booting against a stale schema.
  process.exit(1);
});
