// One command for a whole regression run on a FRESH database:
//   empty PGlite → real deploy script (migrations + Admin) → API :4100 → web :5174
//   → seed.mjs → api.mjs → browser.mjs → everything stopped again.
// Usage (from tests/):  node run-all.mjs        (TEST_PHASE=P1 node run-all.mjs …)
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { DB_URL, ROOT } from './lib.mjs';

const REPO = path.resolve(ROOT, '..');
const children = [];

/** process.env + overrides; an `undefined` override removes the variable entirely. */
function withEnv(overrides) {
  const env = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete env[key];
  return env;
}

function start(name, command, cwd, env = {}) {
  const child = spawn(command, { cwd, env: withEnv(env), shell: true });
  let log = '';
  child.stdout.on('data', (b) => (log += b));
  child.stderr.on('data', (b) => (log += b));
  child.getLog = () => log;
  children.push({ name, child });
  return child;
}
function stopAll() {
  for (const { child } of children.reverse()) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
}
function run(name, command, cwd, env = {}) {
  console.log(`\n▶ ${name}`);
  const res = spawnSync(command, { cwd, env: withEnv(env), shell: true, stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`${name} exited with ${res.status}`);
}
/** Listening on IPv4 or IPv6 loopback (Vite binds `localhost`, which can be ::1 only). */
async function portBusy(port) {
  for (const host of ['127.0.0.1', '::1']) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, host);
      socket.once('connect', () => (socket.destroy(), resolve(true)));
      socket.once('error', () => resolve(false));
    });
    if (open) return true;
  }
  return false;
}
async function waitPort(port, label, child, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await portBusy(port)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${label} did not open :${port}\n${child?.getLog?.().slice(-1500) ?? ''}`);
}

process.on('SIGINT', () => (stopAll(), process.exit(130)));
try {
  for (const port of [54329, 4100, 5174]) {
    if (await portBusy(port)) throw new Error(`port ${port} is already in use — stop the old process first`);
  }
  const db = start('db', 'node db.mjs', ROOT);
  await waitPort(54329, 'test DB', db);

  // DIRECT_URL removed: prisma.config.ts would prefer it over the test DB.
  const dbEnv = { DATABASE_URL: DB_URL, DIRECT_URL: undefined, ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'Admin@12345' };
  run('migrations + bootstrap seed (server/scripts/db-deploy.cjs)', 'node scripts/db-deploy.cjs', path.join(REPO, 'server'), dbEnv);

  const api = start('api', 'npx tsx src/server.ts', path.join(REPO, 'server'), {
    ...dbEnv,
    PORT: '4100',
    NODE_ENV: 'test',
    RATE_LIMIT_MAX: '100000',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
    JWT_ACCESS_EXPIRES_IN: '4h',
    CORS_ORIGIN: 'http://localhost:5174',
    UPLOAD_DIR: path.join(ROOT, 'results', '.uploads'),
    BCRYPT_SALT_ROUNDS: '10',
    APP_TIMEZONE_OFFSET_MINUTES: '330',
  });
  const web = start('web', 'npx vite --port 5174 --strictPort', path.join(REPO, 'client'), {
    VITE_API_BASE_URL: 'http://localhost:4100/api/v1',
  });
  await waitPort(4100, 'API', api);
  await waitPort(5174, 'web app', web);

  run('seed (realistic data via the API)', 'node seed.mjs', ROOT);
  run('API regression', 'node api.mjs', ROOT);
  run('browser workflows (Edge)', 'node browser.mjs', ROOT);
  console.log('\n✔ run complete — results in tests/results/' + (process.env.TEST_PHASE ?? 'P0'));
} catch (err) {
  console.error('\n✖', err.message);
  process.exitCode = 1;
} finally {
  stopAll();
}
