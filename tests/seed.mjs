// Realistic test data, created through the real API (same code paths as production).
// Refuses to run unless the API it talks to is local. Run once on a fresh `db.mjs`.
import { ADMIN, API, PASSWORD, PEOPLE, call, istDay, items, login, saveTokens } from './lib.mjs';

if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(API)) throw new Error(`refusing to seed a non-local API: ${API}`);

const must = (r, label) => {
  if (r.status >= 300) throw new Error(`${label} failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.data;
};
const soft = (r, label) => {
  if (r.status >= 300) console.log(`  ! ${label}: ${r.status} ${r.body?.message ?? ''}`);
  return r.data;
};

/** The next date (from tomorrow) that falls on `weekday` (1 = Mon … 6 = Sat), in IST. */
function nextWeekday(weekday, afterDays = 1) {
  for (let d = afterDays; d < afterDays + 14; d += 1) {
    if (new Date(`${istDay(d)}T00:00:00Z`).getUTCDay() === weekday) return istDay(d);
  }
  throw new Error('unreachable');
}
/** The most recent past working day (not Sunday), `n` working days back. */
function pastWorkday(n) {
  let found = 0;
  for (let d = -1; d > -30; d -= 1) {
    if (new Date(`${istDay(d)}T00:00:00Z`).getUTCDay() !== 0 && ++found === n) return istDay(d);
  }
  throw new Error('unreachable');
}

const TODAY = istDay(0);
const MONTH = TODAY.slice(0, 7);
console.log(`Seeding for ${TODAY} against ${API}`);

const admin = (await login(ADMIN.email, ADMIN.password)).token;
if (items(await call(admin, 'GET', '/users?limit=200')).some((u) => u.email === PEOPLE.rahul.email)) {
  throw new Error('already seeded — restart db.mjs for a fresh database');
}

// ── Territories ──────────────────────────────────────────────────────────
const bihar = must(await call(admin, 'POST', '/territories', { name: 'Bihar', type: 'STATE', code: 'BR' }), 'state');
const patna = must(await call(admin, 'POST', '/territories', { name: 'Patna', type: 'DISTRICT', parentId: bihar.id }), 'district');
const gaya = must(await call(admin, 'POST', '/territories', { name: 'Gaya', type: 'DISTRICT', parentId: bihar.id }), 'district');
const patnaHq = must(
  await call(admin, 'POST', '/territories', { name: 'Patna HQ', type: 'HQ', parentId: patna.id, latitude: 25.6093, longitude: 85.1376, geofenceRadiusM: 8000 }),
  'hq',
);
const gayaHq = must(await call(admin, 'POST', '/territories', { name: 'Gaya HQ', type: 'HQ', parentId: gaya.id }), 'hq');

// ── People ───────────────────────────────────────────────────────────────
const ids = {};
async function person(key, managerKey, territoryId, extra = {}) {
  const p = PEOPLE[key];
  const created = must(
    await call(admin, 'POST', '/users', {
      email: p.email,
      password: PASSWORD,
      fullName: p.fullName,
      role: p.role,
      employeeCode: p.code,
      managerId: managerKey ? ids[managerKey] : undefined,
      territoryId,
      phone: `98${String(Math.abs(hash(p.email))).padStart(8, '0').slice(0, 8)}`,
      joiningDate: '2024-04-01',
      designation: p.role === 'MR' ? 'Medical Representative' : key === 'rsm' ? 'Regional Sales Manager' : 'Area Sales Manager',
      ...extra,
    }),
    `user ${key}`,
  );
  ids[key] = created.id ?? created.user?.id;
}
function hash(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1_000_000_007;
  return h;
}
await person('rsm', null, patnaHq.id);
await person('asm', 'rsm', patnaHq.id);
await person('rahul', 'asm', patnaHq.id, { assignedArea: 'Boring Road / Rajendra Nagar' });
await person('neha', 'asm', patnaHq.id, { assignedArea: 'Kankarbagh / Patliputra' });
await person('sanjay', 'asm', patnaHq.id, { assignedArea: 'Danapur / Khagaul' });
await person('pooja', 'rsm', gayaHq.id, { assignedArea: 'Gaya town' });
console.log('  people', ids);

// ── Doctors (40, MSL sheet fields) ───────────────────────────────────────
const SPECS = ['Physician', 'Cardiologist', 'Gynaecologist', 'Pediatrician', 'Orthopaedic', 'ENT', 'Dermatologist', 'Diabetologist'];
const FIRST = ['Asha', 'Bimal', 'Chitra', 'Deepak', 'Esha', 'Farhan', 'Gita', 'Harish', 'Indu', 'Jitendra', 'Kavita', 'Lalit', 'Meena', 'Nitin', 'Om', 'Prakash', 'Rekha', 'Suresh', 'Tanya', 'Umesh'];
const LAST = ['Verma', 'Sinha', 'Rao', 'Mishra', 'Prasad', 'Ali', 'Jha', 'Thakur', 'Pandey', 'Singh'];
const AREAS = {
  rahul: [['Boring Road', 'HQ'], ['Rajendra Nagar', 'HQ'], ['Bailey Road', 'HQ']],
  neha: [['Kankarbagh', 'HQ'], ['Patliputra', 'HQ']],
  sanjay: [['Danapur', 'EX'], ['Khagaul', 'EX']],
  pooja: [['Gaya Town', 'OS'], ['Bodh Gaya', 'OS']],
  none: [['Phulwari Sharif', 'EX'], ['Fatuha', 'OS'], [null, null]],
};
const plan = [...Array(10).fill('rahul'), ...Array(8).fill('neha'), ...Array(8).fill('sanjay'), ...Array(6).fill('pooja'), ...Array(8).fill('none')];
const doctors = { rahul: [], neha: [], sanjay: [], pooja: [], none: [] };
for (let i = 0; i < plan.length; i += 1) {
  const owner = plan[i];
  const [area, areaType] = AREAS[owner][i % AREAS[owner].length];
  const birthMonth = i % 5 === 0 ? TODAY.slice(5, 7) : String((i % 12) + 1).padStart(2, '0');
  const doc = must(
    await call(admin, 'POST', '/doctors', {
      fullName: `Dr. ${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}${i >= 20 ? ` ${String.fromCharCode(65 + (i % 26))}.` : ''}`,
      area,
      areaType,
      mslClass: ['A', 'B', 'C'][i % 3],
      specialization: SPECS[i % SPECS.length],
      address: `${10 + i}, ${area ?? 'Gandhi Maidan'} Main Road, ${owner === 'pooja' ? 'Gaya' : 'Patna'} - 8000${String(i % 30).padStart(2, '0')}`,
      phone: `97${String(10_000_000 + i * 7919).slice(0, 8)}`,
      email: i % 4 === 0 ? `doctor${i}@clinic.test` : undefined,
      birthday: `${1960 + (i % 25)}-${birthMonth}-${String((i % 27) + 1).padStart(2, '0')}`,
      anniversary: i % 3 === 0 ? `${1990 + (i % 20)}-${String(((i + 4) % 12) + 1).padStart(2, '0')}-15` : undefined,
      mrId: owner === 'none' ? undefined : ids[owner],
    }),
    `doctor ${i}`,
  );
  doctors[owner].push(doc);
}
console.log(`  doctors: ${plan.length} (${doctors.none.length} without MR)`);

// ── Chemists (26 — more than the old 20-row page) ────────────────────────
const STORE_NAMES = ['Shiv Medical Hall', 'Jai Ambe Pharma', 'Gupta Medicos', 'New Life Chemist', 'Apollo Pharmacy Boring Road', 'Sanjivani Medical', 'Ram Medical Store', 'City Drug House', 'Balaji Medicals', 'Om Sai Pharma', 'Kumar Medical Agency', 'Raj Chemist', 'Shree Krishna Medical', 'Patna Drug Centre', 'Sai Kripa Medical', 'Ganga Pharma', 'Maa Tara Medical', 'Lakshmi Medical Hall', 'Durga Medicos', 'Health Plus Pharmacy', 'Bodh Gaya Medical', 'Magadh Pharma', 'Annapurna Chemist', 'Shanti Medical', 'Aarogya Pharmacy', 'Vaishali Medicos'];
const stores = [];
for (let i = 0; i < STORE_NAMES.length; i += 1) {
  stores.push(
    must(
      await call(admin, 'POST', '/stores', {
        name: STORE_NAMES[i],
        ownerName: `${FIRST[(i + 3) % FIRST.length]} ${LAST[i % LAST.length]}`,
        phone: `96${String(20_000_000 + i * 104_729).slice(0, 8)}`,
        city: i >= 20 ? 'Gaya' : 'Patna',
        state: 'Bihar',
        gstNumber: i % 2 === 0 ? `10ABCDE${String(1000 + i)}F1Z${i % 9}` : undefined,
        drugLicenseNumber: `BR-PAT-${20_000 + i}`,
      }),
      `store ${i}`,
    ),
  );
}
console.log(`  chemists: ${stores.length}`);

// ── Products + opening stock ─────────────────────────────────────────────
const MEDS = [
  ['Jovacal 500', 'Calcium + Vitamin D3', 'Tablet', 85],
  ['Jovapan 40', 'Pantoprazole 40mg', 'Tablet', 120],
  ['Jovamox CV 625', 'Amoxicillin + Clavulanate', 'Tablet', 210],
  ['Jovazole Syrup', 'Albendazole', 'Syrup', 45],
  ['Jovaflex Gel', 'Diclofenac Diethylamine', 'Gel', 95],
  ['Jovacet Cold', 'Cetirizine + Paracetamol', 'Tablet', 55],
  ['Jovaron XT', 'Ferrous Ascorbate + Folic Acid', 'Tablet', 160],
  ['Jovaderm Cream', 'Clobetasol', 'Cream', 75],
];
const meds = [];
for (let i = 0; i < MEDS.length; i += 1) {
  const [name, composition, category, mrp] = MEDS[i];
  meds.push(
    must(
      await call(admin, 'POST', '/medicines', {
        name,
        composition,
        category,
        company: 'Jovance Laboratories',
        mrp,
        sku: `JL-SKU-${100 + i}`,
        openingStock: 500,
        batchNumber: `JB${2600 + i}`,
        expiryDate: `2028-0${(i % 9) + 1}-28`,
      }),
      `medicine ${name}`,
    ),
  );
}
console.log(`  medicines: ${meds.length} × 500 units`);

for (const mr of ['rahul', 'neha', 'sanjay', 'pooja']) {
  for (const med of meds.slice(0, 4)) {
    must(await call(admin, 'POST', '/medicine-issues', { mrId: ids[mr], medicineId: med.id, quantity: 30, issueDate: pastWorkday(3) }), `issue ${mr}`);
  }
}
console.log('  samples issued: 4 products × 30 to each MR');

// ── Leave policy + holidays ──────────────────────────────────────────────
const leaveTypes = {};
for (const [code, name, annualQuota, isPaid] of [['CL', 'Casual Leave', 12, true], ['SL', 'Sick Leave', 8, true], ['EL', 'Earned Leave', 15, true], ['LWP', 'Leave Without Pay', 0, false]]) {
  leaveTypes[code] = must(await call(admin, 'POST', '/leaves/types', { code, name, annualQuota, isPaid }), `leave type ${code}`);
}
for (const [offset, name, type] of [[4, 'Chhath Puja', 'FESTIVAL'], [11, 'Guru Nanak Jayanti', 'NATIONAL'], [21, 'Company Foundation Day', 'COMPANY'], [-9, 'Bhai Dooj', 'FESTIVAL']]) {
  soft(await call(admin, 'POST', '/holidays', { holidayDate: istDay(offset), name, type }), `holiday ${name}`);
}
console.log('  leave types: CL SL EL LWP · 4 holidays');

// ── Logins for the field team ────────────────────────────────────────────
const t = { admin };
for (const key of Object.keys(PEOPLE)) t[key] = (await login(PEOPLE[key].email)).token;

// ── Attendance: last 3 working days (manager-marked) + today's check-ins ──
for (const day of [pastWorkday(3), pastWorkday(2), pastWorkday(1)]) {
  for (const [mr, status] of [['rahul', 'PRESENT'], ['neha', day === pastWorkday(1) ? 'LEAVE' : 'PRESENT'], ['sanjay', day === pastWorkday(2) ? 'LATE' : 'PRESENT'], ['pooja', day === pastWorkday(3) ? 'ABSENT' : 'PRESENT']]) {
    if (status === 'LEAVE') continue; // set by the approved leave below
    soft(await call(admin, 'POST', '/attendance/manage', { userId: ids[mr], attDate: day, status, workType: 'FIELD' }), `attendance ${mr} ${day}`);
  }
}
soft(await call(t.rahul, 'POST', '/attendance/check-in', { latitude: 25.6122, longitude: 85.1101, accuracyM: 18, workType: 'FIELD' }), 'rahul check-in');
soft(await call(t.neha, 'POST', '/attendance/check-in', { latitude: 25.5941, longitude: 85.1652, accuracyM: 25, workType: 'FIELD' }), 'neha check-in');
console.log('  attendance: 3 past days + Rahul / Neha checked in today (Sanjay, Pooja not yet)');

// ── Leave requests ───────────────────────────────────────────────────────
const nehaSl = soft(await call(t.neha, 'POST', '/leaves', { leaveTypeId: leaveTypes.SL.id, fromDate: pastWorkday(1), toDate: pastWorkday(1), reason: 'Fever, doctor advised rest' }), 'neha SL');
if (nehaSl?.id) soft(await call(t.asm, 'POST', `/leaves/${nehaSl.id}/decision`, { status: 'APPROVED', decisionRemark: 'Get well soon' }), 'approve neha');
const monday = nextWeekday(1, 3);
soft(await call(t.pooja, 'POST', '/leaves', { leaveTypeId: leaveTypes.CL.id, fromDate: monday, toDate: istDay(Math.round((Date.parse(monday) - Date.parse(TODAY)) / 86_400_000) + 1), reason: 'Family function in village' }), 'pooja CL');
soft(await call(t.sanjay, 'POST', '/leaves', { leaveTypeId: leaveTypes.CL.id, fromDate: nextWeekday(3, 2), toDate: nextWeekday(3, 2), dayPart: 'FIRST_HALF', reason: 'Bank work in the morning' }), 'sanjay half-day');
console.log('  leave: Neha SL approved · Pooja CL pending · Sanjay half-day pending');

// ── Tour plans for this month ────────────────────────────────────────────
const planDays = (mr, chemistIdx) => [
  { planDate: TODAY, workType: 'FIELD', territoryId: patnaHq.id, calls: [...doctors[mr].slice(0, 4).map((d) => ({ doctorId: d.id })), { chemistId: stores[chemistIdx].id }] },
  ...(istDay(1).slice(0, 7) === MONTH ? [{ planDate: istDay(1), workType: 'FIELD', territoryId: patnaHq.id, calls: doctors[mr].slice(4, 7).map((d) => ({ doctorId: d.id })) }] : []),
];
soft(await call(t.rahul, 'PUT', `/tour-plans/my?month=${MONTH}`, { days: planDays('rahul', 0) }), 'rahul plan');
soft(await call(t.rahul, 'POST', `/tour-plans/my/submit?month=${MONTH}`, {}), 'rahul submit');
soft(await call(t.sanjay, 'PUT', `/tour-plans/my?month=${MONTH}`, { days: planDays('sanjay', 5) }), 'sanjay plan');
soft(await call(t.sanjay, 'POST', `/tour-plans/my/submit?month=${MONTH}`, {}), 'sanjay submit');
soft(await call(t.neha, 'PUT', `/tour-plans/my?month=${MONTH}`, { days: planDays('neha', 2) }), 'neha draft');
const rahulPlan = items(await call(t.asm, 'GET', `/tour-plans?month=${MONTH}`)).find((p) => (p.userId ?? p.user?.id) === ids.rahul);
if (rahulPlan) soft(await call(t.asm, 'POST', `/tour-plans/${rahulPlan.id}/decide`, { status: 'APPROVED', remark: 'Good coverage' }), 'approve rahul plan');
console.log('  tour plans: Rahul approved · Sanjay submitted · Neha draft');

// ── Appointments + completed visits (history) ────────────────────────────
async function visit(mr, doctor, day, time, samples) {
  const a = must(await call(t[mr], 'POST', '/appointments', { doctorId: doctor.id, date: day, time, purpose: 'Product detailing' }), `appt ${mr}`);
  soft(
    await call(t[mr], 'POST', `/appointments/${a.id}/complete`, {
      visitDate: day,
      visitTime: time,
      checkInTime: time,
      checkOutTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`,
      discussionNotes: 'Detailed Jovacal 500 and Jovapan 40; doctor asked for literature.',
      doctorFeedback: 'Positive, will prescribe for elderly patients',
      visitOutcome: 'Positive',
      medicineIds: [meds[0].id, meds[1].id],
      distributions: samples ? [{ medicineId: meds[0].id, quantity: 2 }] : [],
    }),
    `complete ${mr}`,
  );
}
await visit('rahul', doctors.rahul[0], pastWorkday(2), '10:30', true);
await visit('rahul', doctors.rahul[1], pastWorkday(1), '11:00', true);
await visit('rahul', doctors.rahul[2], pastWorkday(1), '15:00', false);
await visit('neha', doctors.neha[0], pastWorkday(2), '12:00', true);
await visit('sanjay', doctors.sanjay[0], pastWorkday(3), '10:00', true);
must(await call(t.rahul, 'POST', '/appointments', { doctorId: doctors.rahul[3].id, date: TODAY, time: '11:00', purpose: 'Follow-up on samples' }), 'rahul today appt');
must(await call(t.asm, 'POST', '/appointments', { doctorId: doctors.rahul[4].id, mrId: ids.rahul, date: TODAY, time: '16:00', purpose: 'Joint call — new product launch' }), 'asm assigns rahul');
must(await call(t.neha, 'POST', '/appointments', { doctorId: doctors.neha[1].id, date: istDay(1), time: '12:30', purpose: 'Detailing' }), 'neha tomorrow appt');
console.log('  visits: 5 completed (history) · appointments: Rahul ×2 today, Neha tomorrow');

// ── Expenses, invoices, favourites ───────────────────────────────────────
soft(await call(t.rahul, 'POST', '/expenses', { expenseDate: pastWorkday(1), category: 'TRAVEL', amount: 340, distanceKm: 34, description: 'Bike travel Boring Road → Rajendra Nagar' }), 'rahul expense');
const nehaDa = soft(await call(t.neha, 'POST', '/expenses', { expenseDate: pastWorkday(2), category: 'DAILY_ALLOWANCE', amount: 200, description: 'HQ daily allowance' }), 'neha expense');
if (nehaDa?.id) soft(await call(t.asm, 'POST', `/expenses/${nehaDa.id}/decide`, { status: 'APPROVED' }), 'approve neha expense');
soft(await call(t.rahul, 'POST', '/invoices', { doctorId: doctors.rahul[0].id, invoiceDate: pastWorkday(1), lines: [{ medicineId: meds[0].id, quantity: 10, rate: 70 }] }), 'rahul invoice');
soft(await call(admin, 'POST', '/invoices', { medicalStoreId: stores[1].id, mrId: ids.neha, invoiceDate: pastWorkday(2), lines: [{ medicineId: meds[1].id, quantity: 20, rate: 100, discountPct: 5 }] }), 'store invoice');
soft(await call(t.rahul, 'PUT', `/doctors/${doctors.rahul[1].id}/favorite`), 'favourite');
soft(await call(t.rahul, 'PUT', `/doctors/${doctors.rahul[2].id}/favorite`), 'favourite');

saveTokens({ ...t, ids, doctors: Object.fromEntries(Object.entries(doctors).map(([k, v]) => [k, v.map((d) => ({ id: d.id, fullName: d.fullName, area: d.area }))])), stores: stores.map((s) => ({ id: s.id, name: s.name })), meds: meds.map((m) => ({ id: m.id, name: m.name })), leaveTypes: Object.fromEntries(Object.entries(leaveTypes).map(([k, v]) => [k, v.id])) });
console.log('SEED DONE');
