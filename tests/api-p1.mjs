// P1 — Attendance & Leave + reporting hierarchy, against the seeded test DB.
// Runs after seed.mjs and api.mjs. Uses Neha / test accounts so the browser flows
// (Rahul, Sanjay, Amit) still find the data they expect.
import { createRequire } from 'node:module';
import { DB_URL, PASSWORD, Results, call, istDay, items, loadTokens, login, loginAttempt } from './lib.mjs';
import { tableCounts } from './api.mjs';

const { Client } = createRequire(import.meta.url)('pg');

const t = loadTokens();
const r = new Results('api-p1.json');
const TODAY = istDay(0);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** First date on/after `fromOffset` days from today that is `day` (0 = Sun … 6 = Sat). */
const next = (day, fromOffset) => {
  for (let i = fromOffset; i < fromOffset + 14; i += 1) if (weekday(istDay(i)) === day) return istDay(i);
  throw new Error('unreachable');
};
const before = await tableCounts();
const types = t.leaveTypes;

// ── Leave preview: the policy maths ──────────────────────────────────────
const founder = t.founderDay; // a Tuesday
const mon = addDays(founder, -1);
const wed = addDays(founder, 1);
let x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${mon}&toDate=${wed}&dayPart=FULL`);
r.check('Leave days', 'Mon–Wed with a Tuesday holiday = 2 days', x.data?.days === 2 && x.data.excluded.some((e) => e.reason === "Founder's Day"), x.data);
r.check('Leave days', 'Preview shows the balance after (CL 12 → 10)', x.data?.balance?.available === 12 && x.data?.balance?.after === 10, x.data?.balance);
const sat = next(6, 20);
x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${sat}&toDate=${addDays(sat, 2)}`);
r.check('Leave days', 'Sat–Mon skips Sunday (weekly off) = 2 days', x.data?.days === 2 && x.data.excluded.some((e) => /Sunday/.test(e.reason)), x.data);
x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.SPL}&fromDate=${sat}&toDate=${addDays(sat, 2)}`);
r.check('Leave days', 'Sandwich-rule type counts the Sunday too = 3 days', x.data?.days === 3 && x.data.sandwichRule === true, x.data);
x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${mon}&toDate=${mon}&dayPart=FIRST_HALF`);
r.check('Leave days', 'Half day = 0.5', x.data?.days === 0.5, x.data);
const sunday = next(0, 20);
x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${sunday}&toDate=${sunday}`);
r.check('Leave days', 'Only a Sunday → "no working days" problem', x.data?.problems?.some((p) => p.code === 'NO_WORKING_DAYS'), x.data);
x = await call(t.neha, 'GET', `/leaves/preview?leaveTypeId=${types.SPL}&fromDate=${sat}&toDate=${addDays(sat, 9)}`);
r.check('Leave days', 'More than the balance → balance problem', x.data?.problems?.some((p) => p.code === 'BALANCE'), x.data?.problems);
x = await call(t.asm, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${mon}&toDate=${mon}&userId=${t.ids.neha}`);
r.check('Leave days', 'Manager previews a team member (their balance)', x.status === 200 && x.data?.balance?.code === 'CL', x.data);
x = await call(t.rahul, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${mon}&toDate=${mon}&userId=${t.ids.neha}`);
r.check('Leave days', 'MR cannot preview someone else → 403', x.status === 403, x.status);

// ── Leave apply: validation ──────────────────────────────────────────────
const apply = (token, body) => call(token, 'POST', '/leaves', { leaveTypeId: types.CL, reason: 'Family function', ...body });
x = await apply(t.neha, { fromDate: '2026-02-31', toDate: '2026-02-31' });
r.check('Leave rules', '31 Feb → 422', x.status === 422, x.status);
x = await apply(t.neha, { fromDate: wed, toDate: mon });
r.check('Leave rules', 'To before From → 422', x.status === 422, x.status);
x = await apply(t.neha, { fromDate: sunday, toDate: sunday });
r.check('Leave rules', 'Only weekly-off / holiday days → 400', x.status === 400 && /no working days/i.test(x.body?.message), x.body?.message);
x = await apply(t.neha, { fromDate: `${TODAY.slice(0, 4)}-12-30`, toDate: `${Number(TODAY.slice(0, 4)) + 1}-01-02` });
r.check('Leave rules', 'Range crossing 31 Dec → 400 (apply per year)', x.status === 400 && /apply separately/i.test(x.body?.message), x.body?.message);
const old = addDays(TODAY, -40);
x = await apply(t.neha, { fromDate: old, toDate: old });
r.check('Leave rules', 'Own leave 40 days back → 400 (limit 30)', x.status === 400 && /30 days/.test(x.body?.message), x.body?.message);
x = await apply(t.asm, { fromDate: weekday(old) === 0 ? addDays(old, 1) : old, toDate: weekday(old) === 0 ? addDays(old, 1) : old, userId: t.ids.neha, reason: 'Filed late by manager' });
r.check('Leave rules', 'Manager files it on behalf → allowed', x.status === 201, { status: x.status, msg: x.body?.message });
x = await apply(t.neha, { fromDate: addDays(TODAY, 400), toDate: addDays(TODAY, 400) });
r.check('Leave rules', 'More than 365 days ahead → 400', x.status === 400, { status: x.status, msg: x.body?.message });
x = await apply(t.neha, { fromDate: mon, toDate: wed });
const nehaCl = x.data;
r.check('Leave rules', 'Valid Mon–Wed CL saved with 2 days', x.status === 201 && nehaCl?.days === 2, { status: x.status, msg: x.body?.message, days: nehaCl?.days });
x = await apply(t.neha, { fromDate: wed, toDate: wed });
r.check('Leave rules', 'Overlapping request → 409', x.status === 409 && /overlaps/i.test(x.body?.message), x.body?.message);

// ── Decisions: who may decide, and the mandatory reason ──────────────────
x = await call(t.asm, 'POST', `/leaves/${nehaCl?.id}/decision`, { status: 'REJECTED' });
r.check('Approvals', 'Reject without a reason → 422', x.status === 422, x.status);
x = await call(t.asm, 'POST', `/leaves/${nehaCl?.id}/decision`, { status: 'REJECTED', decisionRemark: '  ' });
r.check('Approvals', 'Reject with a blank reason → 422', x.status === 422, x.status);
x = await call(t.rahul, 'POST', `/leaves/${nehaCl?.id}/decision`, { status: 'APPROVED' });
r.check('Approvals', 'MR cannot decide → 403', x.status === 403, x.status);
const poojaLeave = items(await call(t.admin, 'GET', `/leaves?userId=${t.ids.pooja}&status=PENDING`))[0];
x = await call(t.asm, 'POST', `/leaves/${poojaLeave?.id}/decision`, { status: 'APPROVED' });
r.check('Approvals', 'ASM cannot decide outside his team (Pooja → RSM) → 403', x.status === 403, x.status);
const ownLeave = await apply(t.asm, { fromDate: next(4, 25), toDate: next(4, 25) });
x = await call(t.asm, 'POST', `/leaves/${ownLeave.data?.id}/decision`, { status: 'APPROVED' });
r.check('Approvals', 'Manager cannot approve his own leave → 403', x.status === 403, x.status);
x = await call(t.asm, 'POST', `/leaves/${nehaCl?.id}/decision`, { status: 'REJECTED', decisionRemark: 'Month-end closing week' });
r.check('Approvals', 'Reject with a reason → 200', x.status === 200 && x.data?.decisionRemark === 'Month-end closing week', x.body?.message);
const bell = items(await call(t.neha, 'GET', '/notifications'));
r.check('Approvals', 'Employee is told the reason (notification)', bell.some((n) => n.kind === 'LEAVE_DECIDED' && /Month-end closing week/.test(n.message)), bell.map((n) => n.message).slice(0, 4));
x = await call(t.admin, 'POST', `/leaves/${poojaLeave?.id}/decision`, { status: 'APPROVED' });
r.check('Approvals', 'Admin can decide anyone\'s leave', x.status === 200, x.status);

const regDay2 = (() => {
  for (let i = -2; i > -20; i -= 1) if (weekday(istDay(i)) !== 0 && istDay(i) !== t.regDay) return istDay(i);
  return istDay(-3);
})();
const nehaReg = await call(t.neha, 'POST', '/attendance/regularizations', {
  attDate: regDay2,
  requestedInAt: new Date(`${regDay2}T09:35:00+05:30`).toISOString(),
  reason: 'Forgot to punch in',
});
x = await call(t.asm, 'POST', `/attendance/regularizations/${nehaReg.data?.id}/decide`, { status: 'REJECTED' });
r.check('Approvals', 'Regularization reject without a reason → 422', x.status === 422, x.status);
x = await call(t.asm, 'POST', `/attendance/regularizations/${nehaReg.data?.id}/decide`, { status: 'REJECTED', remark: 'Was on leave that morning' });
r.check('Approvals', 'Regularization reject with a reason → 200', x.status === 200, { status: x.status, msg: x.body?.message });
const flagged = items(await call(t.rsm, 'GET', '/attendance?flagged=true'));
r.check('Approvals', 'RSM sees Pooja\'s flagged check-in (server filter)', flagged.some((row) => row.userId === t.ids.pooja && row.flagReason), flagged.length);
x = await call(t.rsm, 'POST', `/attendance/${flagged[0]?.id}/review-flag`, { outcome: 'REJECT' });
r.check('Approvals', 'Flagged check-in reject without a reason → 422', x.status === 422, x.status);
const asmFlagged = items(await call(t.asm, 'GET', '/attendance?flagged=true'));
r.check('Approvals', 'ASM does not see a flag outside his team', asmFlagged.every((row) => row.userId !== t.ids.pooja), asmFlagged.length);
const pendingOnly = items(await call(t.asm, 'GET', '/leaves?status=PENDING&limit=200'));
r.check('Approvals', 'Status filter is applied on the server', pendingOnly.length > 0 && pendingOnly.every((row) => row.status === 'PENDING'), pendingOnly.map((row) => row.status));

// ── Overview: one call, scoped by role ───────────────────────────────────
const ov = async (token) => (await call(token, 'GET', '/attendance/overview')).data;
const mine = await ov(t.rahul);
r.check('Overview', 'MR sees only himself', mine?.scope === 'SELF' && mine.members === 1, { scope: mine?.scope, members: mine?.members });
const asmOv = await ov(t.asm);
r.check('Overview', 'ASM sees his 3 MRs', asmOv?.scope === 'TEAM' && asmOv.members === 3, { scope: asmOv?.scope, members: asmOv?.members });
r.check('Overview', 'ASM: Sanjay listed as not checked in', !asmOv?.workingDay || asmOv?.notCheckedIn.some((p) => p.id === t.ids.sanjay), asmOv?.notCheckedIn);
r.check('Overview', 'ASM: pending regularization counted', (asmOv?.pending.regularizations ?? 0) >= 1, asmOv?.pending);
const rsmOv = await ov(t.rsm);
r.check('Overview', 'RSM sees his whole line (ASM + 4 MRs)', rsmOv?.members === 5, rsmOv?.members);
r.check('Overview', 'RSM: Pooja\'s flag counted', (rsmOv?.pending.flagged ?? 0) >= 1, rsmOv?.pending);
const adminOv = await ov(t.admin);
r.check('Overview', 'Admin sees the company (6 field users)', adminOv?.scope === 'COMPANY' && adminOv.members >= 6, { scope: adminOv?.scope, members: adminOv?.members });
r.check('Overview', 'Upcoming holidays listed', (adminOv?.upcomingHolidays.length ?? 0) > 0, adminOv?.upcomingHolidays);

// ── Attendance list follows the month ────────────────────────────────────
const monthRows = items(await call(t.rahul, 'GET', `/attendance?from=${TODAY.slice(0, 8)}01&to=${TODAY}&limit=400`));
r.check('Attendance', 'List filtered to the month', monthRows.length > 0 && monthRows.every((row) => row.attDate >= `${TODAY.slice(0, 8)}01`), monthRows.length);

// ── Holidays: everyone reads, only Admin writes ──────────────────────────
x = await call(t.rahul, 'GET', `/holidays?year=${TODAY.slice(0, 4)}`);
r.check('Holidays', 'MR can read the calendar', x.status === 200 && items(x).length >= 5, items(x).length);
x = await call(t.rahul, 'POST', '/holidays', { holidayDate: istDay(50), name: 'MR Holiday' });
r.check('Holidays', 'MR cannot add a holiday → 403', x.status === 403, x.status);
x = await call(t.asm, 'POST', '/holidays/import', { dryRun: true, rows: [{ rowNumber: 2, values: { date: istDay(50), name: 'X' } }] });
r.check('Holidays', 'Manager cannot import → 403', x.status === 403, x.status);
const tmp = await call(t.admin, 'POST', '/holidays', { holidayDate: istDay(60), name: 'Temp Day', type: 'COMPANY' });
await call(t.admin, 'DELETE', `/holidays/${tmp.data?.id}`);
x = await call(t.admin, 'POST', '/holidays', { holidayDate: istDay(60), name: 'Temp Day', type: 'COMPANY' });
r.check('Holidays', 'Re-adding a deleted holiday restores the same row', x.status === 201 && x.data?.id === tmp.data?.id, { status: x.status, before: tmp.data?.id, after: x.data?.id });

const year1 = Number(TODAY.slice(0, 4)) + 1;
const [d, m, y] = t.founderDay.split('-').reverse();
const oldDate = new Date(`${t.oldDay}T00:00:00Z`);
const importRows = [
  { rowNumber: 2, values: { date: `${year1}-01-26`, name: 'Republic Day', type: 'National' } },
  { rowNumber: 3, values: { date: `26/01/${year1}`, name: 'republic day', type: 'national' } },
  { rowNumber: 4, values: { date: `${d}/${m}/${y}`, name: "Founder's Day", type: 'Company' } },
  { rowNumber: 5, values: { date: `31/02/${year1}`, name: 'Impossible Day' } },
  { rowNumber: 6, values: { date: `${year1}-03-03` } },
  { rowNumber: 7, values: { date: `${oldDate.getUTCDate()} ${oldDate.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${oldDate.getUTCFullYear()}`, name: 'Old Company Day', type: 'Company' } },
  { rowNumber: 8, values: { date: `${year1}-03-14`, name: 'Holi', type: 'Fest' } },
  { rowNumber: 9, values: { date: `August 15, ${year1}`, name: 'Independence Day', type: 'National', optional: 'No' } },
  { rowNumber: 10, values: { date: `${year1}-11-01`, name: 'Chhath (optional)', type: 'Festival', optional: 'Yes' } },
];
x = await call(t.admin, 'POST', '/holidays/import', { dryRun: true, rows: importRows });
const statusOf = (rowNumber) => x.data?.rows?.find((row) => row.rowNumber === rowNumber)?.status;
r.check('Holiday import', 'Preview: new row', statusOf(2) === 'NEW', statusOf(2));
r.check('Holiday import', 'Preview: same date + name again in the file', statusOf(3) === 'DUPLICATE_IN_FILE', statusOf(3));
r.check('Holiday import', 'Preview: already in the calendar (DD/MM/YYYY date)', statusOf(4) === 'EXISTS', statusOf(4));
r.check('Holiday import', 'Preview: 31 Feb is invalid', statusOf(5) === 'INVALID', statusOf(5));
r.check('Holiday import', 'Preview: missing name is invalid', statusOf(6) === 'INVALID', statusOf(6));
r.check('Holiday import', 'Preview: deleted holiday → restore', statusOf(7) === 'RESTORE', statusOf(7));
r.check('Holiday import', 'Preview: unknown type is invalid', statusOf(8) === 'INVALID', statusOf(8));
r.check('Holiday import', 'Preview: "August 15, YYYY" understood', statusOf(9) === 'NEW', x.data?.rows?.find((row) => row.rowNumber === 9));
r.check('Holiday import', 'Preview: optional = Yes', x.data?.rows?.find((row) => row.rowNumber === 10)?.isOptional === true, x.data?.rows?.[8]);
const afterPreview = items(await call(t.admin, 'GET', `/holidays?year=${year1}`)).map((h) => h.name);
r.check('Holiday import', 'Preview saves nothing', !afterPreview.includes('Republic Day') && !afterPreview.includes('Independence Day'), afterPreview);
x = await call(t.admin, 'POST', '/holidays/import', { dryRun: false, fileName: 'holidays.xlsx', rows: importRows });
r.check('Holiday import', 'Import: 3 added · 1 restored · 2 skipped · 3 invalid', JSON.stringify(x.data?.summary) === JSON.stringify({ total: 9, added: 3, restored: 1, duplicates: 2, invalid: 3 }), x.data?.summary);
const nextYear = items(await call(t.admin, 'GET', `/holidays?year=${year1}`)).map((h) => h.name);
r.check('Holiday import', 'Imported holidays are in the calendar', nextYear.includes('Republic Day') && nextYear.includes('Independence Day'), nextYear);
x = await call(t.admin, 'POST', '/holidays/import', { dryRun: false, rows: importRows });
r.check('Holiday import', 'Same file again adds nothing', x.data?.summary?.added === 0 && x.data?.summary?.restored === 0, x.data?.summary);
x = await call(t.admin, 'POST', '/holidays/import', { dryRun: true, rows: Array.from({ length: 501 }, (_, i) => ({ rowNumber: i + 2, values: { date: '2030-01-01', name: `H${i}` } })) });
r.check('Holiday import', 'More than 500 rows → 422', x.status === 422, x.status);
const audit = items(await call(t.admin, 'GET', '/audit-logs?action=HOLIDAYS_IMPORTED'));
r.check('Holiday import', 'Import written to the audit log', audit.length >= 1, audit.length);

// ── Reporting hierarchy (test accounts only) ─────────────────────────────
const mkUser = async (email, fullName, role, managerId) => {
  const res = await call(t.admin, 'POST', '/users', { email, password: PASSWORD, fullName, role, managerId, employeeCode: `T-${email.split('@')[0]}` });
  return res.data?.id ?? res.data?.user?.id;
};
const mA = await mkUser('test.asm.a@test.local', 'Test ASM A', 'MANAGER', t.ids.rsm);
const mC = await mkUser('test.asm.c@test.local', 'Test ASM C', 'MANAGER', t.ids.rsm);
const mB = await mkUser('test.asm.b@test.local', 'Test ASM B', 'MANAGER', t.ids.rsm);
const mrX = await mkUser('test.mr.x@test.local', 'Test MR X', 'MR', mA);
r.check('Hierarchy', 'Test accounts created (RSM → ASM A → MR X)', mA && mC && mB && mrX, { mA, mC, mB, mrX });
x = await call(t.admin, 'PATCH', `/users/${mA}`, { managerId: mA });
r.check('Hierarchy', 'Self-reporting blocked', x.status === 400, { status: x.status, msg: x.body?.message });
x = await call(t.admin, 'PATCH', `/users/${t.ids.rsm}`, { managerId: mA });
r.check('Hierarchy', 'Loop blocked (RSM under his own ASM)', x.status === 400 && /reports to this user/i.test(x.body?.message), x.body?.message);
x = await call(t.admin, 'PATCH', `/users/${mrX}`, { managerId: t.ids.rahul });
r.check('Hierarchy', 'An MR cannot be a reporting manager', x.status === 400, x.body?.message);
await call(t.admin, 'POST', `/users/${mB}/deactivate`);
x = await call(t.admin, 'PATCH', `/users/${mrX}`, { managerId: mB });
r.check('Hierarchy', 'Inactive manager cannot take reports', x.status === 400 && /inactive/i.test(x.body?.message), x.body?.message);
x = await call(t.admin, 'POST', `/users/${mA}/deactivate`);
r.check('Hierarchy', 'Manager with reports cannot be deactivated', x.status === 400 && /reassign/i.test(x.body?.message), x.body?.message);
x = await call(t.admin, 'PATCH', `/users/${mA}`, { role: 'MR' });
r.check('Hierarchy', 'Manager with reports cannot become an MR', x.status === 400, x.body?.message);
const opts = items(await call(t.admin, 'GET', `/users/manager-options?forUserId=${t.ids.rsm}`)).map((o) => o.id);
r.check('Hierarchy', 'Manager options leave out self and own team', !opts.includes(t.ids.rsm) && !opts.includes(mA) && !opts.includes(t.ids.asm), opts);
x = await call(t.admin, 'PATCH', `/users/${mrX}`, { fullName: 'Test MR X Renamed', managerId: mA });
const unchanged = items(await call(t.admin, 'GET', '/users?limit=200')).find((u) => u.id === mrX);
r.check('Hierarchy', 'Name edit (same manager sent) keeps the reporting line', x.status === 200 && unchanged?.managerId === mA, unchanged?.managerId);

const tX = (await login('test.mr.x@test.local')).token;
const tA = (await login('test.asm.a@test.local')).token;
const tC = (await login('test.asm.c@test.local')).token;
const xLeave = await call(tX, 'POST', '/leaves', { leaveTypeId: types.CL, fromDate: next(4, 30), toDate: next(4, 30), reason: 'Doctor appointment' });
r.check('Hierarchy', 'ASM A sees MR X\'s leave before the move', (await call(tA, 'GET', `/leaves?userId=${mrX}`)).status === 200, xLeave.status);
x = await call(t.admin, 'PATCH', `/users/${mrX}`, { managerId: mC });
r.check('Hierarchy', 'Admin moves MR X to ASM C', x.status === 200 && x.data?.managerId === mC, x.body?.message);
x = await call(tA, 'GET', `/leaves?userId=${mrX}`);
r.check('Hierarchy', 'ASM A no longer sees MR X → 403', x.status === 403, x.status);
x = await call(tA, 'POST', `/leaves/${xLeave.data?.id}/decision`, { status: 'APPROVED' });
r.check('Hierarchy', 'ASM A cannot approve MR X\'s pending leave any more', x.status === 403, x.status);
x = await call(tC, 'POST', `/leaves/${xLeave.data?.id}/decision`, { status: 'APPROVED' });
r.check('Hierarchy', 'ASM C now approves it', x.status === 200, x.body?.message);
const changeLog = items(await call(t.admin, 'GET', '/audit-logs?action=REPORTING_MANAGER_CHANGED'));
r.check('Hierarchy', 'Exactly one manager change audited (rename was not)', changeLog.length === 1, changeLog.map((row) => row.metadata ?? row.after));
const cBell = items(await call(tC, 'GET', '/notifications'));
r.check('Hierarchy', 'New manager is notified', cBell.some((n) => /now reports to you/.test(n.title)), cBell.map((n) => n.title).slice(0, 3));

// ── Status + own password (Users & Hierarchy UI changes) ─────────────────
x = await call(t.admin, 'POST', `/users/${mB}/activate`);
r.check('Account', 'Reactivating a deactivated account works', x.status === 200 && x.data?.status === 'ACTIVE', x.data?.status);
x = await call(t.admin, 'POST', `/users/${mB}/deactivate`);
r.check('Account', 'Deactivating it again works (no reports)', x.status === 200 && x.data?.status === 'INACTIVE', x.data?.status);
// For the browser's change-own-password flow.
const pwUser = await mkUser('test.mr.pw@test.local', 'Test MR Password', 'MR', mC);
r.check('Account', 'Test account for the password flow', Boolean(pwUser), pwUser);
x = await call(tX, 'POST', '/auth/change-password', { currentPassword: 'Wrong-pass-1', newPassword: 'Field@2026x' });
r.check('Account', 'Own password: wrong current password → 401', x.status === 401 && /incorrect/i.test(x.body?.message), x.body?.message);
x = await call(tX, 'POST', '/auth/change-password', { currentPassword: PASSWORD, newPassword: PASSWORD });
r.check('Account', 'Own password: new = current → 422', x.status === 422, x.status);
x = await call(tX, 'POST', '/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Field@2026x' });
r.check('Account', 'Own password: correct current → changed', x.status === 200, x.body?.message);
r.check('Account', 'Old password no longer signs in', (await loginAttempt('test.mr.x@test.local', PASSWORD)).status === 401, 'old password');
r.check('Account', 'New password signs in', (await loginAttempt('test.mr.x@test.local', 'Field@2026x')).status === 200, 'new password');
x = await call(t.asm, 'POST', `/auth/reset-requests`, { userId: mrX });
r.check('Account', 'A manager cannot create a reset link', x.status === 403 || x.status === 404, x.status);

// ── Deactivation guard: nothing may be stranded in a leaver's name ───────
// A fresh MR collects one of every kind of open work. All three entry points must
// refuse, change nothing, and let go only once every item is settled.
const G = 'Deactivation guard';
const sql = async (text, params) => {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    return (await db.query(text, params)).rows;
  } finally {
    await db.end();
  }
};
const workDay = (offset, step = 1) => {
  for (let i = offset; Math.abs(i - offset) < 7; i += step) if (weekday(istDay(i)) !== 0) return istDay(i);
  throw new Error('unreachable');
};
const MONTH = TODAY.slice(0, 7);
const hq = items(await call(t.admin, 'GET', '/territories?limit=200')).find((row) => row.name === 'Patna HQ')?.id;
const created = await call(t.admin, 'POST', '/users', {
  email: 'test.mr.guard@test.local', password: PASSWORD, fullName: 'Test MR Guard', role: 'MR',
  managerId: t.ids.asm, territoryId: hq, employeeCode: 'T-guard',
});
const gId = created.data?.id ?? created.data?.user?.id;
x = await call(t.admin, 'POST', `/users/${gId}/deactivate`);
r.check(G, 'MR with nothing open can be deactivated', x.status === 200 && x.data?.status === 'INACTIVE', { status: x.status, msg: x.body?.message });
await call(t.admin, 'POST', `/users/${gId}/activate`);
const tG = (await login('test.mr.guard@test.local')).token;

const med = t.meds[2].id;
const issueDay = workDay(-3, -1);
const visitDay = workDay(-2, -1);
const planDay = [0, 1, 2, 3, 4, 5, 6, -1, -2, -3].map(istDay).find((d) => d.slice(0, 7) === MONTH && weekday(d) !== 0);
let leaveDay;
for (let i = 45; i < 90 && !leaveDay; i += 1) {
  const p = await call(tG, 'GET', `/leaves/preview?leaveTypeId=${types.CL}&fromDate=${istDay(i)}&toDate=${istDay(i)}`);
  if (p.data?.days === 1 && !p.data.problems?.length) leaveDay = istDay(i);
}
const work = {
  stock: await call(t.admin, 'POST', '/medicine-issues', { mrId: gId, medicineId: med, quantity: 5, issueDate: issueDay }),
  appointment: await call(t.admin, 'POST', '/appointments', { doctorId: t.doctors.none[0].id, mrId: gId, date: workDay(1), time: '11:30', purpose: 'Detailing' }),
  tourPlan: await call(tG, 'PUT', `/tour-plans/my?month=${MONTH}`, { days: [{ planDate: planDay, workType: 'FIELD', territoryId: hq }] }),
  leave: await call(tG, 'POST', '/leaves', { leaveTypeId: types.CL, fromDate: leaveDay, toDate: leaveDay, reason: 'Personal work' }),
  regularization: await call(tG, 'POST', '/attendance/regularizations', { attDate: visitDay, requestedInAt: new Date(`${visitDay}T09:45:00+05:30`).toISOString(), reason: 'Forgot to punch in' }),
  expense: await call(tG, 'POST', '/expenses', { expenseDate: visitDay, category: 'TRAVEL', amount: 120, distanceKm: 12, description: 'Bike travel to Danapur' }),
};
r.check(G, 'Test MR holds stock, an appointment, a tour plan, leave, regularization and expense', Object.values(work).every((res) => res.status < 300), Object.fromEntries(Object.entries(work).map(([k, res]) => [k, `${res.status} ${res.body?.message ?? ''}`])));
// Last month's approved plan is history and must not count (nothing ever closes an APPROVED plan).
const [yy, mm] = TODAY.split('-').map(Number);
const lastMonth = mm === 1 ? `${yy - 1}-12-01` : `${yy}-${String(mm - 1).padStart(2, '0')}-01`;
await sql(`INSERT INTO tour_plans ("userId", "planMonth", status, "updatedAt") VALUES ($1, $2, 'APPROVED', now())`, [gId, lastMonth]);

/** Everything in the test MR's name, straight from the DB. */
const owned = async () => (await sql(`SELECT
    (SELECT coalesce(sum(qty), 0)::int FROM stock_balances WHERE "holderType" = 'USER' AND "holderId" = $1) AS stock_units,
    (SELECT count(*)::int FROM appointments WHERE "mrId" = $1 AND "deletedAt" IS NULL) AS appointments,
    (SELECT count(*)::int FROM tour_plans WHERE "userId" = $1 AND "deletedAt" IS NULL) AS tour_plans,
    (SELECT count(*)::int FROM leave_requests WHERE "userId" = $1 AND "deletedAt" IS NULL) AS leave,
    (SELECT count(*)::int FROM attendance_regularizations WHERE "userId" = $1 AND "deletedAt" IS NULL) AS regularizations,
    (SELECT count(*)::int FROM expense_claims WHERE "userId" = $1 AND "deletedAt" IS NULL) AS expenses,
    (SELECT count(*)::int FROM stock_txns) AS all_stock_txns,
    (SELECT status::text FROM users WHERE id = $1) AS status,
    (SELECT role::text FROM users WHERE id = $1) AS role,
    (SELECT "deletedAt" IS NOT NULL FROM users WHERE id = $1) AS deleted`, [gId]))[0];
const ownedBefore = await owned();
const everything = 'Stock: 1 item (5 units) · Appointments: 1 · Tour plans: 1 · Pending Leave: 1 · Pending Regularization: 1 · Pending Expense: 1.';
const refused = (res, text) => res.status === 409 && res.body?.message === text;
x = await call(t.admin, 'POST', `/users/${gId}/deactivate`);
r.check(G, 'POST /users/:id/deactivate → 409 with every count', refused(x, `${everything} Please settle or reassign before deactivation.`), { status: x.status, msg: x.body?.message });
r.check(G, 'Only this month\'s tour plan counts (last month\'s approved plan is history)', /Tour plans: 1 /.test(x.body?.message ?? '') && ownedBefore.tour_plans === 2, { msg: x.body?.message, plans: ownedBefore.tour_plans });
r.check(G, 'Refusal carries the counts for the UI (details.pendingWork)', x.body?.details?.pendingWork?.stockUnits === 5 && x.body.details.pendingWork.expense === 1, x.body?.details);
x = await call(t.admin, 'PATCH', `/users/${gId}`, { status: 'INACTIVE' });
r.check(G, 'PATCH /users/:id {status: INACTIVE} → 409, same message', refused(x, `${everything} Please settle or reassign before deactivation.`), { status: x.status, msg: x.body?.message });
x = await call(t.admin, 'DELETE', `/users/${gId}`);
r.check(G, 'DELETE /users/:id (soft delete) → 409', refused(x, `${everything} Please settle or reassign before deletion.`), { status: x.status, msg: x.body?.message });
x = await call(t.admin, 'PATCH', `/users/${gId}`, { role: 'MANAGER', status: 'INACTIVE' });
r.check(G, 'Role change in the same request does not get around it', x.status === 409, { status: x.status, msg: x.body?.message });
const promoted = await call(t.admin, 'PATCH', `/users/${gId}`, { role: 'MANAGER' });
x = await call(t.admin, 'POST', `/users/${gId}/deactivate`);
const demoted = await call(t.admin, 'PATCH', `/users/${gId}`, { role: 'MR' });
r.check(G, 'Making the MR a Manager first does not get around it either', promoted.status === 200 && x.status === 409 && demoted.status === 200, { promoted: promoted.status, deactivate: x.status, demoted: demoted.status });
const ownedAfter = await owned();
r.check(G, 'Refused attempts changed nothing — still active, nothing deleted, moved or posted', JSON.stringify(ownedAfter) === JSON.stringify(ownedBefore) && ownedAfter.status === 'ACTIVE' && ownedAfter.role === 'MR' && ownedAfter.deleted === false, { ownedBefore, ownedAfter });
r.check(G, 'The MR stays signed in (sessions not revoked)', (await call(tG, 'GET', '/auth/me')).status === 200, 'auth/me');

// Settle step by step — each item drops out of the message.
const settled = [
  await call(t.asm, 'POST', `/expenses/${work.expense.data?.id}/decide`, { status: 'REJECTED', remark: 'No receipt attached' }),
  await call(t.asm, 'POST', `/attendance/regularizations/${work.regularization.data?.id}/decide`, { status: 'REJECTED', remark: 'Not on duty that day' }),
  await call(t.asm, 'POST', `/leaves/${work.leave.data?.id}/decision`, { status: 'REJECTED', decisionRemark: 'Handover first' }),
];
x = await call(t.admin, 'POST', `/users/${gId}/deactivate`);
r.check(G, 'Decided requests drop out of the message', settled.every((res) => res.status === 200) && refused(x, 'Stock: 1 item (5 units) · Appointments: 1 · Tour plans: 1. Please settle or reassign before deactivation.'), { settled: settled.map((res) => res.status), msg: x.body?.message });
const submitted = await call(tG, 'POST', `/tour-plans/my/submit?month=${MONTH}`, {});
const gPlan = items(await call(t.asm, 'GET', `/tour-plans?month=${MONTH}&userId=${gId}`))[0];
const planRejected = await call(t.asm, 'POST', `/tour-plans/${gPlan?.id}/decide`, { status: 'REJECTED', remark: 'MR is leaving' });
const cancelled = await call(t.asm, 'PATCH', `/appointments/${work.appointment.data?.id}`, { status: 'CANCELLED' });
x = await call(t.admin, 'PATCH', `/users/${gId}`, { status: 'INACTIVE' });
r.check(G, 'Rejected plan and cancelled appointment drop out — stock alone still blocks', submitted.status === 200 && planRejected.status === 200 && cancelled.status === 200 && refused(x, 'Stock: 1 item (5 units). Please settle or reassign before deactivation.'), { submitted: submitted.status, planRejected: planRejected.status, cancelled: cancelled.status, msg: x.body?.message });
// The bag empties the only way the app allows today: samples given on a visit.
const lastCall = await call(t.admin, 'POST', '/appointments', { doctorId: t.doctors.none[1].id, mrId: gId, date: visitDay, time: '10:00', purpose: 'Last call' });
const done = await call(tG, 'POST', `/appointments/${lastCall.data?.id}/complete`, {
  visitDate: visitDay, visitTime: '10:00', checkInTime: '10:00', checkOutTime: '10:30',
  discussionNotes: 'Handed over the remaining samples.', visitOutcome: 'Positive',
  medicineIds: [med], distributions: [{ medicineId: med, quantity: 5 }],
});
x = await call(t.admin, 'PATCH', `/users/${gId}`, { status: 'INACTIVE' });
r.check(G, 'Once everything is settled, PATCH deactivates', done.status < 300 && x.status === 200 && x.data?.status === 'INACTIVE', { visit: `${done.status} ${done.body?.message ?? ''}`, status: x.status, msg: x.body?.message });
x = await call(t.admin, 'DELETE', `/users/${gId}`);
r.check(G, 'Once everything is settled, DELETE works too', x.status === 200 || x.status === 204, { status: x.status, msg: x.body?.message });
const history = await owned();
r.check(G, 'History stays: plans, appointments, requests still in the DB', history.tour_plans === 2 && history.appointments === 2 && history.leave === 1 && history.regularizations === 1 && history.expenses === 1, history);

const after = await tableCounts();
const lost = Object.keys(before).filter((k) => after[k] < before[k]);
r.check('Data safety', 'No table lost rows during the P1 API run', lost.length === 0, { before, after });
r.save();
