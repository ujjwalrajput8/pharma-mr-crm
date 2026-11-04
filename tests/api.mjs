// API regression on the seeded test DB. PASS / FAIL for what this phase owns,
// KNOWN for audit bugs that a later phase fixes (see IMPROVEMENT_PLAN.md §9).
import { createRequire } from 'node:module';
import { DB_URL, Results, call, istDay, items, loadTokens } from './lib.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const t = loadTokens();
const r = new Results('api.json');
const TODAY = istDay(0);

/** Row counts of the main tables — compared before / after to prove nothing disappears. */
export async function tableCounts() {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const tables = ['users', 'doctors', 'doctor_assignments', 'medical_stores', 'medicines', 'visits', 'appointments', 'stock_txns', 'attendances', 'leave_requests', 'holidays', 'tour_plans', 'invoices', 'expense_claims'];
  const out = {};
  for (const table of tables) {
    const where = ['users', 'doctors', 'medical_stores', 'medicines', 'visits', 'appointments', 'holidays', 'invoices', 'leave_requests', 'expense_claims', 'tour_plans', 'attendances'].includes(table) ? ' WHERE "deletedAt" IS NULL' : '';
    out[table] = Number((await pg.query(`SELECT count(*)::int AS n FROM ${table}${where}`)).rows[0].n);
  }
  await pg.end();
  return out;
}

if (process.argv[1]?.endsWith('api.mjs')) {
  const before = await tableCounts();

  // ── P0: clean 4xx instead of 500 ─────────────────────────────────────────
  const docId = t.doctors.rahul[3].id;
  let x = await call(t.admin, 'GET', '/doctors/abc/details');
  r.check('P0 errors', 'Non-numeric id in URL → 400 (was 500)', x.status === 400, x.status);
  x = await call(t.admin, 'GET', '/employees/undefined');
  r.check('P0 errors', '"undefined" id in URL → 400 (was 500)', x.status === 400, x.status);
  x = await call(t.rahul, 'POST', '/appointments', { doctorId: docId, date: 'not-a-date', time: '10:00' });
  r.check('P0 errors', 'Appointment with text date → 422 (was 500)', x.status === 422, x.status);
  x = await call(t.rahul, 'POST', '/appointments', { doctorId: docId, date: '2026-02-31', time: '10:00' });
  r.check('P0 errors', 'Appointment on 31 Feb → 422', x.status === 422, x.status);
  const appt = (await call(t.rahul, 'POST', '/appointments', { doctorId: docId, date: TODAY, time: '18:30' })).data;
  x = await call(t.rahul, 'POST', `/appointments/${appt?.id}/complete`, { visitDate: 'abc', visitTime: '18:35' });
  r.check('P0 errors', 'Visit complete with text date → 422 (was 500)', x.status === 422, x.status);
  x = await call(t.rahul, 'POST', `/appointments/${appt?.id}/complete`, {
    visitDate: TODAY, visitTime: '18:35', distributions: [{ medicineId: t.meds[0].id, quantity: 20 }, { medicineId: t.meds[0].id, quantity: 20 }],
  });
  r.check('P0 errors', 'Two sample lines beyond stock → 409 "Not enough stock" (was 500)', x.status === 409 && /stock/i.test(x.body?.message ?? ''), { status: x.status, msg: x.body?.message });
  const holidayDate = istDay(40);
  const h1 = await call(t.admin, 'POST', '/holidays', { holidayDate, name: 'Test Re-add Day', type: 'COMPANY' });
  await call(t.admin, 'DELETE', `/holidays/${h1.data?.id}`);
  x = await call(t.admin, 'POST', '/holidays', { holidayDate, name: 'Test Re-add Day', type: 'COMPANY' });
  r.check('P0 errors', 'Re-adding a deleted holiday → 409 clear message (was 500)', x.status === 409, { status: x.status, msg: x.body?.message });
  x = await call(t.admin, 'POST', '/medicines', { name: 'Jovatest 10', mrp: 10, openingStock: 25, batchNumber: 'JT1', expiryDate: '2028-01-31' });
  r.check('P0 errors', 'Medicine with opening stock saves (transaction fix)', x.status === 201, { status: x.status, msg: x.body?.message });
  const stock = items(await call(t.admin, 'GET', '/stock?limit=100')).find((s) => s.medicineId === x.data?.id);
  r.check('P0 errors', 'Its opening stock (25) shows in warehouse', (stock?.available ?? stock?.quantity) === 25, stock);
  x = await call(t.admin, 'POST', '/medicines', { name: 'Bad Expiry', mrp: 10, expiryDate: '31/12/2028' });
  r.check('P0 errors', 'Medicine with a non-ISO expiry → 422 (was 500)', x.status === 422, x.status);

  // ── Role scope (must keep working) ──────────────────────────────────────
  const rahulDocs = items(await call(t.rahul, 'GET', '/doctors?limit=5000'));
  r.check('Scope', 'MR sees only his 10 assigned doctors', rahulDocs.length === 10, rahulDocs.length);
  x = await call(t.neha, 'GET', `/doctors/${docId}/details`);
  r.check('Scope', 'Another MR cannot open that doctor', x.status === 403 || x.status === 404, x.status);
  const rahulVisits = items(await call(t.rahul, 'GET', '/visits?limit=100'));
  r.check('Scope', 'MR sees his own visits (3 seeded)', rahulVisits.length === 3 && rahulVisits.every((v) => v.mrId === t.ids.rahul), rahulVisits.length);
  const nehaVisits = items(await call(t.neha, 'GET', '/visits?limit=100'));
  r.check('Scope', 'Other MR does not see them', nehaVisits.every((v) => v.mrId === t.ids.neha), nehaVisits.length);
  const asmVisits = items(await call(t.asm, 'GET', '/visits?limit=100'));
  r.check('Scope', 'ASM sees his 3 MRs\' visits (5)', asmVisits.length === 5, asmVisits.length);
  const rsmVisits = items(await call(t.rsm, 'GET', '/visits?limit=100'));
  r.check('Scope', 'RSM sees grand-reports\' visits too', rsmVisits.length >= 5, rsmVisits.length, 'B-V6 → P3');

  // ── Every role's main screens answer ────────────────────────────────────
  for (const [who, token] of [['Admin', t.admin], ['RSM', t.rsm], ['ASM', t.asm], ['MR', t.rahul]]) {
    for (const p of ['/dashboard/summary', '/dashboard/occasions', '/notifications', '/employees/photos', '/holidays', '/leaves/types', '/appointments?limit=100', '/visits?limit=100', `/tour-plans/my?month=${TODAY.slice(0, 7)}`]) {
      if (who === 'Admin' && p.startsWith('/tour-plans/my')) continue;
      x = await call(token, 'GET', p);
      r.check('Screens', `${who} GET ${p.split('?')[0]}`, x.status === 200, { status: x.status, msg: x.body?.message });
    }
  }
  x = await call(t.rahul, 'GET', '/my-day');
  r.check('Screens', 'MR My Day', x.status === 200 && (x.data?.appointments?.length ?? 0) >= 2, { status: x.status, appts: x.data?.appointments?.length });
  for (const [who, token] of [['Admin', t.admin], ['ASM', t.asm]]) {
    for (const type of ['daily', 'weekly', 'monthly', 'mr-performance', 'mr-detail', 'doctor-visits', 'appointments', 'distributions', 'stock', 'sales']) {
      const extra = type === 'mr-detail' ? `&mrId=${t.ids.rahul}` : '';
      x = await call(token, 'GET', `/reports?type=${type}&from=${TODAY.slice(0, 8)}01&to=${TODAY}${extra}`);
      r.check('Reports', `${who} ${type}`, x.status === 200, { status: x.status, msg: x.body?.message });
    }
  }

  // ── Audit bugs owned by later phases (expected to fail today) ────────────
  x = await call(t.rahul, 'POST', '/visits', { doctorId: docId, visitDate: TODAY });
  r.check('Later phases', 'MR logs a visit without an appointment', x.status < 300, x.status, 'M1 → P3');
  const stores = items(await call(t.admin, 'GET', '/stores'));
  r.check('Later phases', 'All 26 chemists load', stores.length >= 26, stores.length, 'B-C1 → P4');
  x = await call(t.asm, 'POST', '/doctors', { fullName: 'Dr Team Doctor', area: 'Boring Road' });
  r.check('Later phases', 'Manager adds a team doctor', x.status === 201, x.status, 'B-D1 → P4');
  x = await call(t.admin, 'GET', '/ledger/txns?limit=2000');
  r.check('Later phases', 'Ledger CSV export size accepted', x.status === 200, x.status, 'B-S6 → P7');

  const after = await tableCounts();
  const lost = Object.keys(before).filter((k) => after[k] < before[k]);
  r.check('Data safety', 'No table lost rows during the API run', lost.length === 0, { before, after });
  r.save();
}
