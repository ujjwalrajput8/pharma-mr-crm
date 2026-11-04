// Real browser workflows (installed Microsoft Edge, headless) for Admin, Manager and MR,
// desktop + phone widths. Screenshots go to results/<phase>/screens/.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ADMIN, PASSWORD, PEOPLE, RESULTS, Results, WEB, istDay, loadTokens } from './lib.mjs';
import { tableCounts } from './api.mjs';

const seed = loadTokens();
const r = new Results('browser.json');
const SHOTS = path.join(RESULTS, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const DESKTOP = { width: 1366, height: 768 };
const PHONE = { width: 390, height: 844 };

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: DESKTOP,
  geolocation: { latitude: 25.6122, longitude: 85.1101 },
  permissions: ['geolocation'],
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
});
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));

let shotNo = 0;
async function shot(name) {
  shotNo += 1;
  const file = `${String(shotNo).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: false });
  return file;
}
async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(350);
}
/** One user-visible step: runs, screenshots, records PASS / FAIL (or KNOWN for a later phase). */
async function step(group, name, fn, known) {
  try {
    const detail = await fn();
    const file = await shot(`${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60));
    r.check(group, name, true);
    return { ok: true, file, detail };
  } catch (err) {
    const file = await shot(`FAIL-${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)).catch(() => null);
    r.check(group, name, false, { error: String(err?.message ?? err).split('\n')[0], screenshot: file }, known);
    return { ok: false, file };
  }
}
async function goto(route) {
  await page.goto(WEB + route);
  await settle();
}
async function uiLogin(email, password = PASSWORD) {
  await goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  await settle();
}
async function uiLogout(fullName) {
  await page.getByRole('button', { name: new RegExp(fullName) }).first().click();
  await page.getByText('Logout', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /log ?out/i }).last().click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}
const dialog = () => page.getByRole('dialog').last();
async function noHorizontalScroll() {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (extra > 2) throw new Error(`page scrolls sideways by ${extra}px at ${page.viewportSize()?.width}px`);
}

const countsBefore = await tableCounts();

// ═══ ADMIN ═══════════════════════════════════════════════════════════════
await step('Admin', 'Login → dashboard', async () => {
  await uiLogin(ADMIN.email, ADMIN.password);
  await page.getByText(/dashboard/i).first().waitFor();
});
await step('Admin', 'Doctors list shows all 40', async () => {
  await goto('/doctors');
  await page.getByText('Dr. Asha Verma').first().waitFor();
  await page.getByText(/of 40\b/).first().waitFor({ timeout: 5000 });
});
await step('Admin', 'Duplicate doctor → error shown INSIDE the form', async () => {
  await page.getByRole('button', { name: /add doctor/i }).first().click();
  await dialog().getByLabel("Doctor's Name").fill('Dr. Asha Verma');
  await dialog().getByLabel('Area').fill('Boring Road');
  await page.getByRole('button', { name: /register doctor/i }).click();
  await dialog().getByRole('alert').getByText(/already/i).waitFor({ timeout: 8000 });
});
await step('Admin', 'Fix the name → saved with a success toast', async () => {
  await dialog().getByLabel("Doctor's Name").fill(`Dr. Browser Test ${Date.now() % 100_000}`);
  await page.getByRole('button', { name: /register doctor/i }).click();
  await page.getByText('Doctor added').first().waitFor({ timeout: 8000 });
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
});
await step('Admin', 'Reopened form starts without the old error', async () => {
  await page.getByRole('button', { name: /add doctor/i }).first().click();
  await dialog().getByLabel("Doctor's Name").waitFor();
  if (await dialog().getByRole('alert').count()) throw new Error('stale error still visible');
  await page.keyboard.press('Escape');
});
for (const [route, text] of [['/users', /users/i], ['/stores', /store|chemist/i], ['/medicines', /Jovacal 500/], ['/stock', /Jovacal 500/], ['/reports', /report/i], ['/approvals', /approval/i]]) {
  await step('Admin', `Opens ${route}`, async () => {
    await goto(route);
    await page.getByText(text).first().waitFor({ timeout: 10_000 });
  });
}
await step('Admin', 'Chemists page lists all 26', async () => {
  await goto('/stores');
  await page.getByText('Vaishali Medicos').first().waitFor({ timeout: 5000 });
}, 'B-C1 → P4');
await step('Admin', 'Logout', () => uiLogout('Admin'));

// ═══ MR (Rahul) — right after the Admin, in the same browser tab ════════════
const otherMrDoctor = seed.doctors.neha[0].fullName;
await step('MR', 'Login → dashboard', async () => {
  await uiLogin(PEOPLE.rahul.email);
  await page.getByText(/dashboard|today/i).first().waitFor();
});
await step('MR', 'Doctors: never shows the Admin\'s cached list', async () => {
  await page.goto(WEB + '/doctors');
  // Watch the first 2.5 s of the page: another MR's doctor must never flash on screen.
  for (let i = 0; i < 25; i += 1) {
    if (await page.getByText(otherMrDoctor, { exact: true }).count()) throw new Error(`saw ${otherMrDoctor} (Admin's cache)`);
    await page.waitForTimeout(100);
  }
  await settle();
  await page.getByText(seed.doctors.rahul[0].fullName).first().waitFor();
  await page.getByText(/of 10\b/).first().waitFor({ timeout: 5000 });
});
await step('MR', 'My Day shows today\'s plan and appointments', async () => {
  await goto('/my-day');
  await page.getByText(seed.doctors.rahul[3].fullName).first().waitFor({ timeout: 10_000 });
});
await step('MR', 'Complete today\'s appointment → visit saved', async () => {
  await goto('/appointments');
  const row = page.locator('tr', { hasText: seed.doctors.rahul[3].fullName }).first();
  await row.getByRole('button', { name: /^complete$/i }).click();
  await dialog().getByText(/complete appointment/i).first().waitFor();
  await page.getByRole('button', { name: /complete & save visit/i }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 });
  await goto('/visits');
  await page.getByText(seed.doctors.rahul[3].fullName).first().waitFor({ timeout: 10_000 });
});
await step('MR', 'Apply for leave (CL, next week)', async () => {
  await goto('/leave');
  await page.getByRole('button', { name: /apply for leave/i }).first().click();
  const from = istDay(14);
  // Required fields carry a "*" in their label, so match on the start of the name.
  await dialog().getByLabel(/^Leave type/).selectOption({ label: 'CL — Casual Leave' });
  for (const [label, value] of [[/^From\s*\*?$/, from], [/^To\s*\*?$/, from]]) {
    const input = dialog().getByLabel(label);
    await input.fill(value);
    await input.press('Enter');
  }
  await dialog().getByLabel(/^Reason/).fill('Cousin wedding in Muzaffarpur');
  await dialog().getByRole('button', { name: /submit request/i }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 });
  await page.getByText(/pending/i).first().waitFor();
});
await step('MR', 'Attendance page (checked in today)', async () => {
  await goto('/attendance');
  await page.getByText(/check(ed)?[- ]?(in|out)/i).first().waitFor({ timeout: 10_000 });
});
await step('MR', 'Holiday calendar visible to MR', async () => {
  await goto('/holidays');
  await page.getByText('Chhath Puja').first().waitFor({ timeout: 5000 });
}, 'MR holiday view → P1');

// Phone width
await page.setViewportSize(PHONE);
for (const route of ['/my-day', '/doctors', '/appointments', '/visits', '/leave']) {
  await step('MR phone', `${route} fits a 390px screen`, async () => {
    await goto(route);
    await noHorizontalScroll();
  }, 'responsive layout → P6');
}
await page.setViewportSize(DESKTOP);
await step('MR', 'Logout', () => uiLogout(PEOPLE.rahul.fullName));

// ═══ MANAGER (ASM Amit) ═════════════════════════════════════════════════════
await step('Manager', 'Login → dashboard', async () => {
  await uiLogin(PEOPLE.asm.email);
  await page.getByText(/dashboard/i).first().waitFor();
});
await step('Manager', 'Approve Sanjay\'s half-day leave', async () => {
  await goto('/approvals');
  // One <li> per pending request — never a whole section (it would hold other people's buttons).
  const row = page.locator('li', { hasText: PEOPLE.sanjay.fullName }).filter({ has: page.getByRole('button', { name: /^approve$/i }) });
  if ((await row.count()) !== 1) throw new Error(`expected 1 pending row for Sanjay, found ${await row.count()}`);
  await row.getByRole('button', { name: /^approve$/i }).click();
  await dialog().getByRole('button', { name: /approve/i }).last().click();
  await page.getByText(/leave approved/i).first().waitFor({ timeout: 10_000 });
  // The request must leave the pending list, and Rahul's must still be there.
  await row.waitFor({ state: 'detached', timeout: 10_000 });
  // (Rahul has two pending items — his leave and his expense claim.)
  await page.locator('li', { hasText: PEOPLE.rahul.fullName }).getByRole('button', { name: /^approve$/i }).first().waitFor();
});
await step('Manager', 'Tour plan inbox shows Sanjay\'s submitted plan', async () => {
  await goto('/tour-plan');
  await page.getByRole('tab', { name: /inbox/i }).or(page.getByRole('button', { name: /inbox/i })).first().click();
  await settle();
  await page.getByText(PEOPLE.sanjay.fullName).first().waitFor({ timeout: 10_000 });
});
await step('Manager', 'Team visits list', async () => {
  await goto('/visits');
  await page.getByText(PEOPLE.rahul.fullName).first().waitFor({ timeout: 10_000 });
});
await step('Manager', 'Doctors page: no Admin-only buttons that fail', async () => {
  await goto('/doctors');
  if (await page.getByRole('button', { name: /add doctor/i }).count()) throw new Error('Add Doctor shown to Manager but the server answers 403');
}, 'B-D1 → P4');
await step('Manager', 'Logout', () => uiLogout(PEOPLE.asm.fullName));

const countsAfter = await tableCounts();
const lost = Object.keys(countsBefore).filter((k) => countsAfter[k] < countsBefore[k]);
r.check('Data safety', 'No table lost rows during the browser run', lost.length === 0, { countsBefore, countsAfter });
r.check('Console', 'No uncaught page errors', consoleErrors.length === 0, consoleErrors.slice(0, 5));
fs.writeFileSync(path.join(RESULTS, 'counts.json'), JSON.stringify({ countsBefore, countsAfter }, null, 2));
r.save();
await browser.close();
