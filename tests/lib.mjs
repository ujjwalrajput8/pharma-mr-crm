// Shared helpers for the local regression scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const API = process.env.TEST_API ?? 'http://localhost:4100/api/v1';
export const WEB = process.env.TEST_WEB ?? 'http://localhost:5174';
export const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable';
export const PHASE = process.env.TEST_PHASE ?? 'P0';
export const RESULTS = path.join(ROOT, 'results', PHASE);
fs.mkdirSync(RESULTS, { recursive: true });

export const PASSWORD = 'Passw0rd!';
export const ADMIN = { email: 'admin@test.local', password: 'Admin@12345', name: 'Admin' };
/** Seeded people. RSM → ASM → 3 MRs; one MR reports straight to the RSM. */
export const PEOPLE = {
  rsm: { email: 'vikram.rsm@test.local', fullName: 'Vikram Singh', role: 'MANAGER', code: 'JL-RSM01' },
  asm: { email: 'amit.asm@test.local', fullName: 'Amit Kumar', role: 'MANAGER', code: 'JL-ASM01' },
  rahul: { email: 'rahul.mr@test.local', fullName: 'Rahul Sharma', role: 'MR', code: 'JL-MR001' },
  neha: { email: 'neha.mr@test.local', fullName: 'Neha Gupta', role: 'MR', code: 'JL-MR002' },
  sanjay: { email: 'sanjay.mr@test.local', fullName: 'Sanjay Yadav', role: 'MR', code: 'JL-MR003' },
  pooja: { email: 'pooja.mr@test.local', fullName: 'Pooja Kumari', role: 'MR', code: 'JL-MR004' },
};

export async function call(token, method, urlPath, body) {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, data: json?.data ?? json };
}

export const items = (r) => (Array.isArray(r.data) ? r.data : (r.data?.items ?? r.data?.rows ?? []));

export async function login(email, password = PASSWORD) {
  const r = await call(null, 'POST', '/auth/login', { email, password });
  if (!r.data?.accessToken) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.data.accessToken, user: r.data.user };
}

/** Tokens saved by the seed, so the API checks don't spend the login rate limit. */
const TOKENS = path.join(ROOT, 'results', '.tokens.json');
export function saveTokens(tokens) {
  fs.writeFileSync(TOKENS, JSON.stringify(tokens, null, 2));
}
export function loadTokens() {
  return JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
}

/** Date-only string in IST, offset by whole days. */
export function istDay(offsetDays = 0) {
  const now = new Date(Date.now() + 330 * 60 * 1000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

/** Collects PASS / FAIL / KNOWN rows and writes them as JSON for the report. */
export class Results {
  constructor(file) {
    this.file = path.join(RESULTS, file);
    this.rows = [];
  }
  /** `known` = a bug already scheduled for a later phase (expected to fail now). */
  check(group, name, ok, detail, known) {
    const status = ok ? 'PASS' : known ? 'KNOWN' : 'FAIL';
    this.rows.push({ group, name, status, detail: ok ? undefined : detail, known: ok ? undefined : known });
    const tail = ok ? '' : `  → ${JSON.stringify(detail)?.slice(0, 220)}${known ? `  [${known}]` : ''}`;
    console.log(`${status.padEnd(5)} ${group} · ${name}${tail}`);
  }
  save() {
    const summary = {
      pass: this.rows.filter((r) => r.status === 'PASS').length,
      fail: this.rows.filter((r) => r.status === 'FAIL').length,
      known: this.rows.filter((r) => r.status === 'KNOWN').length,
    };
    fs.writeFileSync(this.file, JSON.stringify({ summary, rows: this.rows }, null, 2));
    console.log(`\n${summary.pass} pass · ${summary.fail} fail · ${summary.known} known (later phase)`);
    return summary;
  }
}
