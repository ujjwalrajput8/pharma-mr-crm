// P1 browser workflows — Attendance & Leave module + reporting hierarchy, in Edge,
// for MR, Manager and Admin, desktop + phone. Runs after browser.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, PASSWORD, PEOPLE, RESULTS, call, istDay, items, loadTokens } from './lib.mjs';
import { DESKTOP, PHONE, createSession } from './browser-lib.mjs';
import { tableCounts } from './api.mjs';

const seed = loadTokens();
const { r, page, settle, step, goto, uiLogin, uiLogout, dialog, noHorizontalScroll, close } =
  await createSession('browser-p1.json');

const TODAY = istDay(0);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isSunday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
const holidays = new Set([istDay(4), istDay(11), istDay(21), seed.founderDay]);
const satBeforeFounder = addDays(seed.founderDay, -3); // Sat → Sun (weekly off) → Mon → Tue (Founder's Day)
/** A working day ~2 weeks out, clear of seeded holidays, of the P0 leave (today + 14)
 *  and of the Sat–Tue range the Founder's Day step applies for. */
const leaveDay = (() => {
  for (let i = 16; i < 40; i += 1) {
    const day = istDay(i);
    if (!isSunday(day) && !holidays.has(day) && !(day >= satBeforeFounder && day <= seed.founderDay)) return day;
  }
  throw new Error('no free day');
})();
const year1 = Number(TODAY.slice(0, 4)) + 1;
const before = await tableCounts();

async function fillDate(label, value) {
  const input = dialog().getByLabel(label);
  await input.fill(value);
  await input.press('Enter');
}
const preview = () => dialog().getByTestId('leave-preview');

// ═══ MR (Rahul) ═════════════════════════════════════════════════════════════
await step('MR', 'Sidebar: one "Attendance & Leave" menu (old ones gone)', async () => {
  await uiLogin(PEOPLE.rahul.email);
  await page.getByRole('link', { name: 'Attendance & Leave' }).first().waitFor();
  for (const gone of ['Approvals', 'Leave Policy', 'Holiday Calendar', 'Attendance', 'Leave']) {
    if (await page.getByRole('link', { name: gone, exact: true }).count()) throw new Error(`sidebar still shows "${gone}"`);
  }
});
await step('MR', 'Tabs: Overview · My Attendance · Leave · Holiday Calendar — no Approvals / Policy', async () => {
  await goto('/attendance-leave');
  for (const name of ['Overview', 'My Attendance', 'Leave', 'Holiday Calendar']) {
    await page.getByRole('tab', { name, exact: true }).waitFor();
  }
  for (const name of ['Approvals', 'Policy']) {
    if (await page.getByRole('tab', { name, exact: true }).count()) throw new Error(`MR sees the "${name}" tab`);
  }
});
await step('MR', 'An approvals link falls back to Overview', async () => {
  await goto('/attendance-leave?tab=approvals');
  await page.waitForURL(/tab=overview/, { timeout: 10_000 });
  await page.getByTestId('overview-tab').waitFor();
});
await step('MR', 'Overview: own day + this month', async () => {
  await page.getByText(/Your attendance for today|No attendance is expected/).first().waitFor();
  await page.getByText(/so far/).first().waitFor();
  await page.getByText('My leave balance').first().waitFor();
});
await step('MR', 'My Attendance: click a future day → leave form opens on that day', async () => {
  await page.getByRole('tab', { name: 'My Attendance', exact: true }).click();
  await settle();
  if (leaveDay.slice(0, 7) !== TODAY.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).first().click();
  await page.locator(`button[data-date="${leaveDay}"]`).click();
  await dialog().getByText('Apply for leave').first().waitFor();
  const from = await dialog().getByLabel(/^From\s*\*?$/).inputValue();
  if (from !== leaveDay) throw new Error(`From is ${from}, expected ${leaveDay}`);
});
await step('MR', 'CL → live preview "1 working day" + balance → submit', async () => {
  await dialog().getByLabel(/^Leave type/).selectOption({ label: 'CL — Casual Leave' });
  await preview().getByText('1 working day').waitFor({ timeout: 10_000 });
  await preview().getByText(/CL balance [\d.]+ → [\d.]+ after approval/).waitFor();
  await dialog().getByLabel(/^Reason/).fill('Sister engagement ceremony');
  await dialog().getByRole('button', { name: 'Submit request' }).click();
  await page.getByText('Leave request submitted').first().waitFor({ timeout: 10_000 });
});
await step('MR', 'Leave tab lists the request as pending', async () => {
  await page.getByRole('tab', { name: 'Leave', exact: true }).click();
  await settle();
  await page.locator('tr', { hasText: 'Sister engagement ceremony' }).getByText('PENDING').waitFor();
});
await step('MR', 'Same day again → preview says it overlaps, Submit stays off', async () => {
  await page.getByRole('button', { name: /apply for leave/i }).first().click();
  await dialog().getByLabel(/^Leave type/).selectOption({ label: 'CL — Casual Leave' });
  await fillDate(/^From\s*\*?$/, leaveDay);
  await fillDate(/^To\s*\*?$/, leaveDay);
  await preview().getByText(/Overlaps an existing CL request/).waitFor({ timeout: 10_000 });
  if (await dialog().getByRole('button', { name: 'Submit request' }).isEnabled()) throw new Error('Submit enabled for an overlap');
});
await step('MR', 'Sat → Tue: Sunday and Founder\'s Day are not counted (2 days)', async () => {
  await fillDate(/^From\s*\*?$/, satBeforeFounder);
  await fillDate(/^To\s*\*?$/, seed.founderDay);
  await preview().getByText('2 working days').waitFor({ timeout: 10_000 });
  await preview().getByText(/Sunday \(weekly off\)/).waitFor();
  await preview().getByText(/Founder's Day/).waitFor();
  await page.keyboard.press('Escape');
});
await step('MR', 'Holiday Calendar: names + Sunday weekly off, no Add / Import', async () => {
  await page.getByRole('tab', { name: 'Holiday Calendar', exact: true }).click();
  await settle();
  await page.getByText('Weekly off').first().waitFor();
  await page.getByText(/Chhath Puja|Guru Nanak Jayanti|Founder's Day|Company Foundation Day/).first().waitFor();
  if (await page.getByRole('button', { name: /^import$/i }).count()) throw new Error('MR sees Import');
  if (await page.getByRole('button', { name: /add holiday/i }).count()) throw new Error('MR sees Add holiday');
});

await page.setViewportSize(PHONE);
for (const tab of ['overview', 'attendance', 'leave', 'holidays']) {
  await step('MR phone', `?tab=${tab} fits a 390px screen`, async () => {
    await goto(`/attendance-leave?tab=${tab}`);
    await noHorizontalScroll();
  });
}
await step('MR phone', 'Apply-leave form is usable on a phone', async () => {
  await goto('/attendance-leave?tab=overview');
  await page.getByRole('button', { name: 'Apply leave' }).first().click();
  const submit = dialog().getByRole('button', { name: 'Submit request' });
  await submit.waitFor();
  const box = await submit.boundingBox();
  if (!box || box.y + box.height > PHONE.height) throw new Error(`Submit is off screen (${JSON.stringify(box)})`);
  await page.keyboard.press('Escape');
});
await page.setViewportSize(DESKTOP);
await step('MR', 'Logout', () => uiLogout(PEOPLE.rahul.fullName));

// ═══ MANAGER (ASM Amit) ═════════════════════════════════════════════════════
await step('Manager', 'Overview: team counts + who has not checked in', async () => {
  await uiLogin(PEOPLE.asm.email);
  await goto('/attendance-leave');
  await page.getByText(/people in your team/).first().waitFor();
  const offDay = await page.getByText(/No attendance is expected today/).count();
  if (!offDay) await page.getByTestId('not-checked-in').getByText(PEOPLE.sanjay.fullName).waitFor();
});
await step('Manager', 'Approvals: Reject stays off until a reason is written', async () => {
  await page.getByRole('tab', { name: 'Approvals', exact: true }).click();
  await settle();
  const row = page.getByTestId('approval-row').filter({ hasText: 'Sister engagement ceremony' });
  await row.getByRole('button', { name: 'Reject' }).click();
  const confirm = dialog().getByRole('button', { name: 'Reject', exact: true });
  if (await confirm.isEnabled()) throw new Error('Reject allowed without a reason');
  await dialog().getByLabel(/^Reason for rejection/).fill('Team offsite that week');
  await confirm.click();
  await page.getByText('Leave rejected').first().waitFor({ timeout: 10_000 });
  await row.waitFor({ state: 'detached', timeout: 10_000 });
});
const approvals = () => page.getByTestId('approvals-tab');
await step('Manager', 'Approvals: approve Sanjay\'s missed-punch regularization', async () => {
  await approvals().getByRole('tab', { name: /^Regularization/ }).click();
  await settle();
  const row = page.getByTestId('approval-row').filter({ hasText: PEOPLE.sanjay.fullName });
  await row.getByRole('button', { name: 'Approve' }).click();
  await dialog().getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByText(/Regularization approved/).first().waitFor({ timeout: 10_000 });
});
await step('Manager', 'Approvals: history filter shows the rejected leave with its reason', async () => {
  await approvals().getByRole('tab', { name: /^Leave/ }).click();
  await approvals().getByLabel('Status').selectOption('REJECTED');
  await settle();
  await page.getByTestId('approval-row').filter({ hasText: 'Team offsite that week' }).first().waitFor();
});
await step('Manager', 'Holiday Calendar is view-only', async () => {
  await page.getByRole('tab', { name: 'Holiday Calendar', exact: true }).click();
  await settle();
  if (await page.getByRole('button', { name: /^import$/i }).count()) throw new Error('Manager sees Import');
});
await step('Manager', 'Logout', () => uiLogout(PEOPLE.asm.fullName));

// ═══ MR again — sees why ═══════════════════════════════════════════════════
await step('MR', 'Leave history shows REJECTED with the manager\'s reason', async () => {
  await uiLogin(PEOPLE.rahul.email);
  await goto('/attendance-leave?tab=leave');
  const row = page.locator('tr', { hasText: 'Sister engagement ceremony' });
  await row.getByText('REJECTED').waitFor();
  await row.getByTestId('decision-remark').getByText(/Team offsite that week/).waitFor();
});
await step('MR', 'Logout', () => uiLogout(PEOPLE.rahul.fullName));

// ═══ ADMIN ═════════════════════════════════════════════════════════════════
const csv = path.join(RESULTS, 'holiday-import-test.csv');
const [fd, fm, fy] = seed.founderDay.split('-').reverse();
fs.writeFileSync(
  csv,
  [
    'Date,Holiday name,Type,Optional,Description',
    `${year1}-04-14,Ambedkar Jayanti,National,No,`,
    `14/04/${year1},Ambedkar Jayanti,National,No,duplicate row`,
    `${fd}/${fm}/${fy},Founder's Day,Company,No,already in calendar`,
    `30/02/${year1},Bad Date Day,Festival,No,`,
    `${year1}-10-02,Gandhi Jayanti,National,No,`,
  ].join('\n'),
);

await step('Admin', 'Tabs include Policy; Overview is company-wide', async () => {
  await uiLogin(ADMIN.email, ADMIN.password);
  await goto('/attendance-leave');
  await page.getByRole('tab', { name: 'Policy', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Attendance', exact: true }).waitFor();
  await page.getByText(/people in the company/).first().waitFor();
});
for (const [oldUrl, tab] of [['/leave', 'leave'], ['/holidays', 'holidays'], ['/approvals', 'approvals'], ['/attendance', 'attendance'], ['/leave-policy', 'policy']]) {
  await step('Admin', `Old address ${oldUrl} opens the ${tab} tab`, async () => {
    await goto(oldUrl);
    await page.waitForURL(new RegExp(`/attendance-leave\\?tab=${tab}`), { timeout: 10_000 });
  });
}
await step('Admin', 'Holiday import: preview shows every row\'s result', async () => {
  await goto('/attendance-leave?tab=holidays');
  await page.getByRole('button', { name: /^import$/i }).click();
  await dialog().locator('input[type="file"]').setInputFiles(csv);
  const summary = dialog().getByTestId('holiday-import-summary');
  await summary.waitFor({ timeout: 15_000 });
  for (const text of ['2 new', '2 skipped', '1 invalid']) await summary.getByText(text).waitFor();
  if ((await dialog().locator('tr[data-status="INVALID"]').count()) !== 1) throw new Error('expected one invalid row');
});
await step('Admin', 'Import saves the 2 new holidays → they appear in the calendar', async () => {
  await dialog().getByRole('button', { name: 'Import 2 holidays' }).click();
  await page.getByText('Holidays imported').first().waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Next year' }).click();
  await page.getByRole('tab', { name: 'Full year list' }).click();
  await settle();
  await page.getByText('Ambedkar Jayanti').first().waitFor();
  await page.getByText('Gandhi Jayanti').first().waitFor();
});
await step('Admin', 'Same file again → nothing to import (no duplicates)', async () => {
  await page.getByRole('button', { name: /^import$/i }).click();
  await dialog().locator('input[type="file"]').setInputFiles(csv);
  await dialog().getByTestId('holiday-import-summary').getByText('0 new').waitFor({ timeout: 15_000 });
  if (await dialog().getByRole('button', { name: 'Nothing to import' }).isEnabled()) throw new Error('import still enabled');
  await page.keyboard.press('Escape');
});
await step('Admin', 'Template download works', async () => {
  await page.getByRole('button', { name: /^import$/i }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    dialog().getByRole('button', { name: 'Download template' }).click(),
  ]);
  if (download.suggestedFilename() !== 'holiday-import-template.xlsx') throw new Error(download.suggestedFilename());
  await page.keyboard.press('Escape');
});
await step('Admin', 'Add a holiday by hand', async () => {
  await page.getByRole('button', { name: /add holiday/i }).first().click();
  await fillDate(/^Date/, `${year1}-12-25`);
  await dialog().getByLabel(/^Holiday name/).fill('Christmas');
  await dialog().getByRole('button', { name: 'Add holiday' }).click();
  await page.getByText('Holiday added').first().waitFor({ timeout: 10_000 });
});

// Reporting hierarchy — on the test accounts made by api-p1.mjs, never the seeded team.
await step('Admin', 'Edit RSM: reporting dropdown never offers him or his team', async () => {
  await goto('/users');
  // Search first (the list is paged), then pick the row by employee code — the
  // RSM's name also appears in every "Reports to" cell.
  await page.getByPlaceholder(/Search name, code/).fill(PEOPLE.rsm.code);
  await page.locator('tr', { hasText: PEOPLE.rsm.code }).getByRole('button', { name: 'Edit' }).click();
  const options = await dialog().getByLabel('Reporting manager').locator('option').allTextContents();
  for (const name of [PEOPLE.rsm.fullName, PEOPLE.asm.fullName, 'Test ASM A']) {
    if (options.some((option) => option.includes(name))) throw new Error(`"${name}" offered — would make a loop`);
  }
  await page.keyboard.press('Escape');
});
await step('Admin', 'Move Test MR X to ASM A → impact shown before saving', async () => {
  await page.getByPlaceholder(/Search name, code/).fill('test.mr.x');
  await page.locator('tr', { hasText: 'Test MR X Renamed' }).getByRole('button', { name: 'Edit' }).click();
  const select = dialog().getByLabel('Reporting manager');
  const value = await select.locator('option', { hasText: 'Test ASM A' }).getAttribute('value');
  await select.selectOption(value);
  await dialog().getByRole('button', { name: 'Save changes' }).click();
  const impact = dialog().getByTestId('reporting-impact');
  await impact.getByText('Test ASM C').first().waitFor();
  await impact.getByText('Test ASM A').first().waitFor();
  await impact.getByText(/will stop seeing/).waitFor();
});
await step('Admin', 'Confirm → saved; reporting tree shows the new line', async () => {
  await dialog().getByRole('button', { name: 'Confirm change' }).click();
  await page.getByText('Reporting line updated').first().waitFor({ timeout: 10_000 });
  await page.getByRole('tab', { name: 'Reporting tree' }).click();
  const depth = async (name) => Number(await page.locator(`[data-testid="tree-node"][data-name="${name}"]`).getAttribute('data-depth'));
  const [rsm, asmA, mrX] = [await depth(PEOPLE.rsm.fullName), await depth('Test ASM A'), await depth('Test MR X Renamed')];
  if (!(rsm === 0 && asmA === 1 && mrX === 2)) throw new Error(`depths rsm=${rsm} asmA=${asmA} mrX=${mrX}`);
});
const users = items(await call(seed.admin, 'GET', '/users?limit=200'));
const mrXId = users.find((u) => u.fullName === 'Test MR X Renamed')?.id;
await step('Admin', 'Employee profile "Change" (next to Reports to) opens the same edit dialog', async () => {
  await goto(`/employees/${mrXId}`);
  await page.getByRole('link', { name: 'Change' }).first().click();
  await page.waitForURL(/\/users\?edit=/);
  await dialog().getByText('Edit Test MR X Renamed').waitFor();
  await page.keyboard.press('Escape');
});

// Status toggle + reset password moved out of the list. Rows are found by the
// account's email (a manager's name also shows in their reports' rows).
const statusSwitch = (email) => page.locator('tr', { hasText: email }).getByRole('switch');
const ASM_A = 'test.asm.a@test.local';
const ASM_B = 'test.asm.b@test.local';
await step('Admin', 'Users list: status is a toggle — no Deactivate / Activate / Reset password buttons', async () => {
  await goto('/users');
  for (const name of [/^deactivate$/i, /^activate$/i, /^reset password$/i]) {
    if (await page.getByRole('button', { name }).count()) throw new Error(`still shows a "${name}" button`);
  }
  await page.getByPlaceholder(/Search name, code/).fill('test.asm');
  await statusSwitch(ASM_A).waitFor();
  if ((await statusSwitch(ASM_A).getAttribute('aria-checked')) !== 'true') throw new Error('active account shown as off');
});
await step('Admin', 'Toggle on reactivates a deactivated account straight away', async () => {
  await statusSwitch(ASM_B).click();
  await page.getByText('Account reactivated').first().waitFor({ timeout: 10_000 });
  await page.locator('tr', { hasText: ASM_B }).getByRole('switch', { checked: true }).waitFor();
});
await step('Admin', 'Toggle off asks first, then deactivates', async () => {
  await statusSwitch(ASM_B).click();
  await dialog().getByText('Deactivate this account?').waitFor();
  await dialog().getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Account deactivated').first().waitFor({ timeout: 10_000 });
  await page.locator('tr', { hasText: ASM_B }).getByText('Deactivated').waitFor();
});
await step('Admin', 'A manager with a team is not deactivated (rule kept)', async () => {
  await statusSwitch(ASM_A).click();
  await dialog().getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText(/reassign them first/).first().waitFor({ timeout: 10_000 });
  if ((await statusSwitch(ASM_A).getAttribute('aria-checked')) !== 'true') throw new Error('switch flipped although the server refused');
});
// Sanjay still carries samples, a pending leave and a tour plan — the server refuses.
// His row shows the employee code (his designation takes the email's place).
const SANJAY = PEOPLE.sanjay.code;
await step('Admin', 'An MR still holding stock / pending work is refused — counts shown, toggle stays on', async () => {
  await page.getByPlaceholder(/Search name, code/).fill(SANJAY);
  await statusSwitch(SANJAY).click();
  await dialog().getByText('Deactivate this account?').waitFor();
  await dialog().getByRole('button', { name: 'Deactivate' }).click();
  await page
    .getByText(/Stock: \d+ items? \(\d+ units\).*Please settle or reassign before deactivation\./)
    .first()
    .waitFor({ timeout: 10_000 });
  if ((await statusSwitch(SANJAY).getAttribute('aria-checked')) !== 'true') throw new Error('switch flipped although the server refused');
});
await step('Admin', 'After a reload the MR is still Active — the server changed nothing', async () => {
  await page.reload();
  await settle();
  await page.getByPlaceholder(/Search name, code/).fill(SANJAY);
  await page.locator('tr', { hasText: SANJAY }).getByRole('switch', { checked: true }).waitFor();
  await page.locator('tr', { hasText: SANJAY }).getByText('Active', { exact: true }).waitFor();
  const account = await call(seed.admin, 'GET', `/users/${seed.ids.sanjay}`);
  if (account.data?.status !== 'ACTIVE') throw new Error(`server says ${account.data?.status}`);
});
await step('Admin', 'Employee profile: Reset password asks first, then gives a one-time link', async () => {
  await goto(`/employees/${mrXId}`);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await dialog().getByText(/Reset password — Test MR X Renamed\?/).waitFor();
  await dialog().getByRole('button', { name: 'Yes, create reset link' }).click();
  const link = await dialog().locator('input[readonly]').inputValue({ timeout: 10_000 });
  if (!/reset-password\?token=/.test(link)) throw new Error(`unexpected link ${link}`);
  await page.keyboard.press('Escape');
});
await page.setViewportSize(PHONE);
await step('Admin phone', 'Users & Hierarchy fits a 390px screen', async () => {
  await goto('/users');
  await noHorizontalScroll();
});
await page.setViewportSize(DESKTOP);
await step('Admin', 'Logout', () => uiLogout('Admin'));

// ═══ Any user — change own password ═════════════════════════════════════════
const NEW_PASSWORD = 'Field@2027y';
await step('Own password', 'Wrong current password is refused (message in the form)', async () => {
  await uiLogin('test.mr.pw@test.local');
  await goto('/profile?change-password=1');
  await dialog().getByLabel(/^Current password/).fill('Not-my-pass1');
  await dialog().getByLabel(/^New password/).fill(NEW_PASSWORD);
  await dialog().getByLabel(/^Confirm new password/).fill(NEW_PASSWORD);
  await dialog().getByRole('button', { name: 'Update password' }).click();
  await dialog().getByText(/Current password is incorrect/).waitFor({ timeout: 10_000 });
});
await step('Own password', 'Mismatched confirmation keeps Update disabled', async () => {
  await dialog().getByLabel(/^Confirm new password/).fill(`${NEW_PASSWORD}x`);
  await dialog().getByText('Passwords do not match').waitFor();
  if (await dialog().getByRole('button', { name: 'Update password' }).isEnabled()) throw new Error('enabled on mismatch');
});
await page.setViewportSize(PHONE);
await step('Own password phone', 'Change-password form fits a phone', async () => {
  await noHorizontalScroll();
  const box = await dialog().getByRole('button', { name: 'Update password' }).boundingBox();
  if (!box || box.y + box.height > PHONE.height + 400) throw new Error(`button far off screen (${JSON.stringify(box)})`);
});
await page.setViewportSize(DESKTOP);
await step('Own password', 'Correct current password → success → signed out → new password works', async () => {
  await dialog().getByLabel(/^Current password/).fill(PASSWORD);
  await dialog().getByLabel(/^Confirm new password/).fill(NEW_PASSWORD);
  await dialog().getByRole('button', { name: 'Update password' }).click();
  await page.getByText('Password changed').first().waitFor({ timeout: 10_000 });
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await uiLogin('test.mr.pw@test.local', NEW_PASSWORD);
});
await step('Own password', 'Logout', () => uiLogout('Test MR Password'));

const after = await tableCounts();
const lost = Object.keys(before).filter((k) => after[k] < before[k]);
r.check('Data safety', 'No table lost rows during the P1 browser run', lost.length === 0, { before, after });
fs.writeFileSync(path.join(RESULTS, 'counts-p1.json'), JSON.stringify({ before, after }, null, 2));
await close();
r.save();
