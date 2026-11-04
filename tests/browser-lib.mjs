// Shared browser session for the workflow scripts: installed Microsoft Edge
// (headless) via playwright-core, step recording and screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PASSWORD, RESULTS, Results, WEB } from './lib.mjs';

export const DESKTOP = { width: 1366, height: 768 };
export const PHONE = { width: 390, height: 844 };

/** One browser tab for a whole script; `file` names the results JSON (and the screenshot prefix). */
export async function createSession(file) {
  const r = new Results(file);
  const shots = path.join(RESULTS, 'screens');
  fs.mkdirSync(shots, { recursive: true });
  const prefix = file === 'browser.json' ? '' : `${file.replace(/\.json$/, '').replace(/^browser-/, '')}-`;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: DESKTOP,
    geolocation: { latitude: 25.6122, longitude: 85.1101 },
    permissions: ['geolocation'],
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  let shotNo = 0;
  const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  async function shot(name) {
    shotNo += 1;
    const fileName = `${prefix}${String(shotNo).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(shots, fileName), fullPage: false });
    return fileName;
  }
  async function settle() {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  /** One user-visible step: runs, screenshots, records PASS / FAIL (or KNOWN for a later phase). */
  async function step(group, name, fn, known) {
    try {
      const detail = await fn();
      const fileName = await shot(slug(`${group}-${name}`));
      r.check(group, name, true);
      return { ok: true, file: fileName, detail };
    } catch (err) {
      const fileName = await shot(slug(`FAIL-${group}-${name}`)).catch(() => null);
      r.check(group, name, false, { error: String(err?.message ?? err).split('\n')[0], screenshot: fileName }, known);
      return { ok: false, file: fileName };
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
  async function close() {
    r.check('Console', 'No uncaught page errors', consoleErrors.length === 0, consoleErrors.slice(0, 5));
    await browser.close();
  }

  return { r, page, context, shot, settle, step, goto, uiLogin, uiLogout, dialog, noHorizontalScroll, close };
}
