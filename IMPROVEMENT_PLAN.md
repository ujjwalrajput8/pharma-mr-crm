# Pharma MR CRM — Consolidated Product Improvement Plan

**Date:** 4 Nov 2026 · **Status:** ✅ **Approved (v2 — aapke 9 badlav ke saath)** · P0 chal raha hai. Har phase ke baad report + aapka approval, phir agla phase.

### v2 mein kya badla (aapke corrections)
| # | Correction | Plan mein kahan |
|---|---|---|
| 1 | Unassigned doctor ka visit MR log kare, **doctor apne aap assign nahi hoga**; Manager review karke assign kare | 2.2, 2.11, 6 |
| 2 | MR chemist add kare — **duplicate check + Manager verification** | 2.10, 6 |
| 3 | Visit frequency target **Admin Settings** se, default A = 3, B = 2, C = 1 | 3.13 |
| 4 | MR deactivate: doctors, chemists, pending appointments, tour plans, **stock** — sabka safe handling | 2.9 |
| 5 | **P0 mein realistic test DB + Admin / Manager / MR ke asli browser workflows** — sirf build / API test "complete" nahi | 7, 8 |
| 6 | Doctor profile ka "New invoice" = **existing Sales / POB ka invoice form** — naya billing module nahi | 3.3 |
| 7 | Completed visit kisi role se delete nahi; correction + sample correction audited | 4 |
| 8 | Existing records / tables / features safe; **koi destructive migration nahi** | 6 |
| 9 | Har phase ke baad: test results, failed cases, screenshots, changed files — **approval ke bina agla phase nahi** | 7.1 |
**Inputs:** `AUDIT_REPORT.md` (saare bug / missing IDs) + aapki UX Simplification requirements + meri product analysis (pharma field-force CRM ke real-world workflows).

---

## 0. Ek nazar mein

**Problem:** App mein features bahut hain par bikhre hue hain. Ek MR ko roz ka kaam karne ke liye 15 menu items, Manager ko 21, Admin ko 26 dikhte hain. Ek hi kaam (leave approve, visit add, doctor assign) alag-alag pages par aadha-aadha hai. Kuch zaroori kaam (bina appointment visit, chemist link) hain hi nahi, aur ~70 bugs data ko galat ya chhupa dete hain.

**Hal — 5 seedhi baatein:**
1. **Har kaam ki ek jagah** — related pages ko ek module ke tabs mein milana (Attendance & Leave, Doctors & Chemists, Visits, Samples & Stock, Users & Access, Settings).
2. **Har role ko sirf uska kaam** — MR 9 menu, Manager 11, Admin 13 (abhi 15 / 21 / 26).
3. **Ek form, kai darwaze** — "Log visit", "Book appointment", "Assign MR", "Apply leave" ek hi dialog, har relevant screen se khule.
4. **Data kabhi na khoye** — completed visit kabhi delete nahi; correction audit ke saath; stock correction alag aur audited.
5. **Har phase browser mein test** — Admin / Manager / MR teeno se asli clicks, desktop + mobile.

**Kya nahi karenge (complexity se bachne ke liye):** offline app, native mobile app, chat, gamification, AI suggestions, e-detailing (slides dikhana), custom report builder, multi-level approval chains. Ye sab bade hain aur abhi ki zaroorat nahi.

---

## 1. Naya navigation (role ke hisaab se)

### 1.1 Sidebar — pehle vs baad

| Group | MR (15 → 9) | Manager (21 → 11) | Admin (26 → 13) |
|---|---|---|---|
| **Daily work** | **Today** (home) · Doctors & Chemists · Visits · Tour Plan | Dashboard · Doctors & Chemists · Visits · Tour Plan | Dashboard · Doctors & Chemists · Visits · Tour Plan |
| **People** | Attendance & Leave · Expenses | Attendance & Leave · Expenses · Team | Attendance & Leave · Expenses · Employees |
| **Business** | My Samples · Sales / POB · Reports | Samples & Stock · Products · Sales / POB · Reports | Samples & Stock · Products · Sales / POB · Reports |
| **Admin** | — | — | Users & Access · Settings |

Mobile par MR ke liye neeche bottom bar: **Today · Doctors · Visits · Attendance · More**.

### 1.2 Kya kahan gaya (koi feature nahi hatega, purane links redirect honge)

| Abhi ka page | Naya ghar | Kyun |
|---|---|---|
| Attendance, Leave, Holiday Calendar, Leave Policy, Approvals (leave / regularization / flagged) | **Attendance & Leave** → tabs | Ek hi vishay; MR ko chhutti apply karne ke liye page nahi badalna padega |
| Approvals → Expense claims | **Expenses** → "Team claims" tab (pehle se hai) | Do jagah se approve karna duplicate tha |
| Approvals → Tour plans | **Tour Plan** → Team view (pehle se hai) | — |
| *(global Approvals page)* | **Dashboard "Pending approvals" card** — har type ka count + seedha link | Manager ko ek nazar mein sab dikhe, par approve ek hi jagah ho |
| My Day + MR Dashboard | **Today** (MR ka home) | MR ke do "home" the — ek bana diya |
| My Day (Manager) | Dashboard → "My day" tab | Manager bhi field karta hai (joint work) |
| Appointments | **Visits** → "Appointments" tab | Plan aur asli visit alag tabs, ek menu |
| Chemists / Stores | **Doctors & Chemists** → "Chemists" tab | Dono "customers" hain, actions same |
| Birthdays & Anniversaries | Today / Dashboard widget → "View all" (page rahega) | Sidebar halka |
| My Stock, Sample Given, Issue to MR, Stock Balances, Ledger | **My Samples** (MR) / **Samples & Stock** (Manager / Admin) → tabs | Ek MR ke liye 3 menu ek ho gaye |
| Users & Hierarchy, Manager Access | **Users & Access** → tabs | — |
| Settings, Territories, Audit Log | **Settings** → tabs | Admin config ek jagah |

**Technical tareeka (kam risk):** abhi ke pages ko hi tab-panel bana denge (unka andar ka code wahi rahega). Tab URL mein rahega (`/attendance-leave?tab=leave`) taaki notification aur bookmark ke links chalein. Purane routes (`/leave`, `/holidays`, `/approvals`, …) redirect karenge.

---

## 2. Roz ke workflows — naye tareeke se

### 2.1 MR ka din — "Today" screen (sabse zaroori)
```
┌ Today · Tue 4 Nov ───────────────────────────────┐
│ [✓ Checked in 9:42]     Calls 3/8 · Samples 12   │
├ Aaj ka plan (Tour Plan) ─────────────────────────┤
│ Dr. Asha Verma · JL-014 · Boring Road  [Log visit]│
│ Shiv Medical (chemist) · Boring Road   [Log visit]│
├ Appointments ────────────────────────────────────┤
│ 12:00 Dr. Bimal Sinha                  [Complete] │
├ Follow-ups due · Visit due (A-class, 25 din) ────┤
│ [+ Unplanned visit]   [Mark planned calls done]  │
└───────────────────────────────────────────────────┘
```
- **Unplanned visit** = raste mein mila doctor / chemist → wahi Log Visit form.
- **Mark planned calls done** = bulk, preview ke saath.
- Shaam ko: "3 planned calls log nahi hue" yaad dilana.
- **Kyun:** MR ka 80% kaam isi ek screen se ho jaayega — attendance, plan, visit, follow-up. Abhi MR ko My Day → Appointments → Complete → Visits ghoomna padta hai, aur unplanned visit ka raasta hi nahi.

### 2.2 Log Visit — ek form, 6 darwaze
Darwaze: Doctors list (row icon) · Doctor profile · Chemist row / profile · Visits page "+ Log visit" · Today (plan / appointment / unplanned) · MR profile (Manager joint work).
Form: doctor **ya** chemist (picker mein MSL No · area · address) · date / time · products discussed · samples (MR ke **apne bag** ka stock dikhe) · notes / feedback / outcome · next follow-up.
Rules (server par):
- Ek MR + ek doctor / chemist + ek din = ek visit (duplicate par saaf message "Aaj pehle hi visit ho chuka").
- Future date nahi; purani date sirf back-date window tak (decision #2).
- Usi din ka pending appointment ho to apne aap link + complete.
- Save retry-safe (net chala gaya aur dobara dabaya to duplicate nahi banega).
- **Assigned nahi wala doctor:** picker mein "Search all doctors" — MR company ka koi bhi doctor (naam / MSL / area) dhoondh ke visit log kar sake. Visit par "Unlisted" tag lagega. **Doctor MR ko apne aap assign nahi hoga** — Manager review karega (2.11).

### 2.3 Bulk visit
Doctors list mein select → "Log visits" → **preview table** (har doctor: ✅ ready / ⚠️ aaj pehle se visit / ⚠️ MR ko assigned nahi) → Save → result "8 bane · 2 skip". Har doctor ka alag visit record. Samples bulk mein nahi (wo per-visit).

### 2.4 Visit correction (naya business rule)
Detail section 4 mein. Short: **Delete button khatam.** "Correct visit" → kya badla + kyun (reason zaroori) → audit mein before / after. Samples ki galti alag "Sample correction" se — ledger mein audited entry, Manager / Admin ke haath.

### 2.5 Leave apply — kahin se bhi
Attendance calendar par din par click → "Apply leave" (same dialog) · Leave tab · Today par "On leave?" — sab ek hi form. Form mein live dikhega: "3 working din kategi (Sunday + Diwali chhod ke) · balance 7 → 4". Overlap pehle se block hai. Naya: agar un dinon tour plan mein calls hain to warning "4 planned calls hain".

### 2.6 Manager ka din — Dashboard (Team)
```
Aaj: 18/22 checked-in · 2 on leave · 2 not checked-in (naam + photo)
Calls aaj: 64 / 120 planned        Pending: Leave 3 · Tour plan 2 · Expense 5 · Regularization 1
Is mahine: Call avg 9.2 · Coverage 78% · Missed A-class doctors 14   [Team leaderboard]
```
- **Kyun:** Manager subah sabse pehle yahi poochta hai: "kaun kaam par hai, kaun nahi, kya pending hai". Abhi ye 4 pages mein bikhra hai aur Manager ko poori company ka data dikh raha hai (B-R1).

### 2.7 Admin — Dashboard + "Data health"
Company cards ke saath ek **Data health** card: bina MR ke doctors · inactive MR ke paas doctors · 60 din mein expire hone wale batches · low stock · bina territory ke users.
- **Kyun:** Audit ke kai bugs isi se aate hain (B-D3 jaise) — Admin ko problem khud dikh jaaye.

### 2.8 Holiday import
Holiday Calendar → "Import" → template download → file chuno → **preview** (har row: ✅ / ❌ galat date / ❌ naam khaali / ⚠️ file mein duplicate / ⚠️ pehle se hai) → Save → "18 added · 3 duplicate skip · 1 invalid".

### 2.9 MR chhod gaya / deactivate — safe handling
Deactivate (ya delete) dabate hi ek **checklist dialog** khulega. Har item ka count dikhega aur har ek ka faisla lena hoga. Sab ek transaction mein hoga, sab audit log mein:

| Item | Options | Default |
|---|---|---|
| Assigned doctors (120) | Doosre MR ko transfer · "Unassigned" pool mein | — (chunna zaroori) |
| Assigned chemists (15) | Same | — |
| Future pending / rescheduled appointments (6) | Naye MR ko (agar doctors transfer hue) · Cancel ("MR deactivated" remark) | Doctors ke saath |
| Tour plans | Submitted (pending approval) → reject with remark "MR deactivated" · Draft / Approved → history ke liye jaise hain | — |
| **Stock in bag** (42 units, 5 medicines) | Warehouse mein wapas (`RETURN`) · Doosre MR ko transfer (`TRANSFER`) — ledger mein entry | **Zaroori** — bag khaali kiye bina deactivate nahi |
| Pending leave / regularization | Future pending → cancel; past rehne do | — |
| Pending expenses | Rehne do (settlement baaki ho sakta hai) — sirf warning | — |
| Login | Saare sessions band | Auto |

- **Kuch delete nahi hoga** — visits, invoices, attendance, purane appointments sab history mein.
- Reactivate karne par assignments apne aap wapas nahi aayenge.
- **Kyun:** Abhi doctors chupchap dead MR ke naam par atke rehte hain (B-D3), aur uske bag ka stock "gayab" ho jaata hai.

### 2.10 MR chemist add kare — duplicate check + verification
1. MR "Add chemist" (Log Visit dialog se bhi) → naam, area / city, phone.
2. **Save se pehle duplicate check:** same naam (spelling-insensitive) + same area / city, ya same phone → "Ye pehle se hain: Shiv Medical Hall (Boring Road)" → MR existing chune ya "Naya hi hai" confirm kare.
3. Naya chemist **"Unverified"** banega — MR turant uska visit log kar sakta hai (field ka kaam na ruke).
4. Manager ke paas "Chemists to verify" list → **Verify** · **Edit + verify** · **Reject** (reject = inactive; uske visits history mein rahenge).
5. Pehle se bane saare chemists **Verified** maane jaayenge.
- Duplicate merge (do records ek karna) abhi nahi — Reject se kaam chalega.

### 2.11 Unlisted visits — Manager review
- Manager ke Dashboard "Pending" card aur Visits page par filter **"Unlisted — review"**.
- Har row par: **Assign doctor to this MR** (normal assignment, audit ke saath) · **Mark reviewed** (assign nahi karna).
- Visit record kabhi nahi badlega — sirf review status.

---

## 3. Module-by-module plan

Har module mein: **Reuse** (jo chal raha hai) · **Combine** · **Improve** · **New** · **Bugs** (audit IDs).

### 3.1 Attendance & Leave (naya combined module)
| Tab | Kaun dekhe | Reuse | Naya / Improve |
|---|---|---|---|
| **Overview** | Sab (data role-wise: Admin company, Manager team, MR khud) | Attendance summary API (abhi unused tha), leave balances, team leave calendar, holidays | Aaj: present / late / absent / leave / half-day* / not marked; is mahine ka summary; pending requests; agle holidays; aaj / is hafte kaun chhutti par |
| **Attendance** | MR: apna · Manager: Mine / Team switch · Admin: Team | Register calendar, list, check-in / out, regularization, mark / correct | Month filter sach mein lage (B-H2); din par click → Apply leave; search |
| **Leave** | Jinke paas `leaves:own` | Apply form (type, dates, full / half / short, reason, attachment), history, status, decision remark, overlap block, holiday / Sunday / sandwich calc | Live "kitne din katenge" preview; tour-plan clash warning; on-behalf balance fix (B-H1) |
| **Approvals** | Sirf Manager (team) / Admin (company) | Leave decide, regularization decide, flagged check-ins | Filters Pending / Approved / Rejected (server-side — B-A1, B-A2); confirm dialog; reject par reason zaroori; MR ko link nahi dikhega (B-A3); server par team-scope check |
| **Holiday Calendar** | **Sab** (abhi MR ko dikhta hi nahi) · edit sirf Admin | Calendar + year list, CRUD, WEEKLY_OFF type, territory holidays | Sundays + weekly-offs saaf; **Excel / CSV import + preview + template** (2.8); deleted holiday re-add 500 fix (B-H4) |
| **Policy** | Sirf Admin | Leave Policy page (types, quota, entitlement) | Bas tab mein shift |

\* Half-day = approved half-day leave wala din (alag attendance status nahi banayenge — data model nahi badlega).

### 3.2 Visits & Appointments
- **Reuse:** appointment create / assign / reschedule / cancel / complete, visit details, sample deduction.
- **Combine:** Visits + Appointments ek menu, do tabs ("Visit log", "Appointments"). Plan aur asli visit alag concept hi rahenge.
- **New:** Log Visit (M1), Bulk (M2), visit rules (M10), correction + sample correction (section 4), chemist visit (M3), no-show (M14), location stamp (optional, phone allow kare to — Manager ko bharosa).
- **Improve:** server filters MR / date / doctor / planned-unplanned + paging (M9, B-V7); columns area / address / MR photo; sample picker MR ka stock (B-V8); follow-up clear ho (B-V9); team scope poori hierarchy (B-V6).
- **Bugs:** B-V2, B-V3, B-V4, B-V5, B-V10–V14, U1 (API mein doctor address), U13.

### 3.3 Doctors & Chemists (combined module)
- **Doctors tab:**
  - Reuse: list, MSL, import, favourite, bulk assign.
  - Row actions: Log visit · Book appointment · View.
  - Filters: MR, area, class, speciality, status, **"visit due / not visited 30+ din"**, birthday this month.
  - New column **Last visit** (rang ke saath: class ke frequency target ke hisaab se).
- **Doctor profile:**
  - Header actions: Edit · Assign MR · Log visit · Book appointment · Add / link chemist · New invoice (M7).
  - **New invoice = Sales / POB wala existing invoice form** (`InvoiceCreateModal`), doctor pehle se bhara. Same API, same invoice list, same outstanding — **koi naya billing module nahi.** Chemist profile par bhi yahi.
  - Tabs: Overview · Visits · Appointments · **Chemists** · Samples · Billing.
  - Timeline time fix (B-D5), dates readable (U6).
- **Chemists tab:**
  - List all (20 limit fix B-C1), type (Chemist / Stockist), area, linked doctors, assigned MR, last visit.
  - Edit + profile page (M6), MR assignment (M5).
  - Doctor ↔ chemist link, many-to-many (M4); bahari chemist bina doctor ke.
- **Pickers — ek shared component:**
  - Har doctor / chemist dropdown mein naam + MSL No + area + address, MSL / address se search (U1, U2).
  - Native selects hatenge (Quick POB, Reports).
  - Appointment form mein location doctor ke address se prefill hoga, aur Admin / Manager ke liye chune hue MR ke doctors hi dikhenge (U3, B-D7).
- **Manager:** apni team ke doctors / chemists add / edit / assign (server par team-scope) — B-D1, B-D2 (decision #4).
- **Bugs:** B-D3 (deactivate flow 2.9), B-D4 (delete par pending appointments cancel, future tour-plan calls hatao), B-D6, B-D8, B-D9, B-D10, U12, U14.

### 3.4 Tour Plan
- **Reuse:** draft / submit / approve, doctor + chemist calls, joint work.
- **Improve:**
  - Calendar par holidays + approved leave dikhe.
  - Saved calls mein area na khoye (U12).
  - Team view mein **planned vs actual** — kitne planned calls par visit hua (M13).
- Approve yahin hoga (global Approvals se shift).

### 3.5 Today (MR) / My Day
Section 2.1. Reuse MyDay API + MR dashboard insights. New: row actions, unplanned visit, bulk done, day summary, "visit due" list. `GET /tour-plans/today` (abhi unused) yahan kaam aayega.

### 3.6 Samples & Stock
- **MR — "My Samples":** tabs *Bag mein* (My Stock) · *Mila* (issues) · *Diya* (distributions).
- **Manager / Admin:** tabs *Warehouse stock* · *Issue to MR* · *Samples given* · *Ledger*.
- **Improve:**
  - Zero-stock medicines dikhein (B-S1); zero par adjust (B-S2).
  - Multi-batch + expiry-first (B-S3, B-V5).
  - Paging (B-S4, B-S9).
  - Ledger CSV (B-S6).
  - Manager issue kar sake (B-S7); dropdown mein sirf MR (B-S8).
  - IST date (B-S10).
  - **Expiry alert** (60 din).
  - Sample correction entries bhi yahin dikhengi.

### 3.7 Products
Edit UI (M12), low-stock threshold sach mein save ho (B-S5), search generic / company par bhi.

### 3.8 Sales / POB
Fix B-SL1 (Admin ne MR nahi chuna to save rok do / doctor ke MR se bharo), B-SL2, B-SL3, B-SL4, B-SL5, B-SL6, B-SL7, U14. Doctor / Chemist profile se "New invoice".

### 3.9 Dashboard
Section 2.1 / 2.6 / 2.7. Fix B-R1 (Manager scope), B-R2, B-R3 (MR ka apna stock), B-R4 (IST din), B-R9, B-R10; currency format ek jaisa (U7).

### 3.10 Reports — kam par kaam ke
- Date presets: Is mahina / Pichhla mahina / Custom.
- Headers insaani bhasha mein (U15); empty states.
- **CSV + PDF dono sach mein chalein** (B-R5).
- Fix: Manager filters (B-R6), labels (B-R7), chupke cut (B-R8 — paging ya "showing 200 of 950").
- **3 naye, jo pharma managers sach mein dekhte hain:**
  1. **Doctor coverage** — MR-wise: MSL doctors me se kitne is mahine mile (%).
  2. **Visit frequency** — class-wise target (A = 3, B = 2, C = 1 / mahina) vs asli.
  3. **Missed doctors** — 30+ din se nahi mile.
- **Kyun:** "Call average", "Coverage %", "Frequency compliance" — Indian pharma field force ke 3 standard KPI hain. Inke bina Manager andaza nahi laga sakta ki MR sahi doctors ko sahi baar mil raha hai ya nahi. Ye sab existing visit data se nikalte hain — naya data entry nahi.

### 3.11 Users & Team / Employees / Documents
- **Users & Access:**
  - User edit — manager, territory, role, email (M11); territory set hogi to geo-fence chalega.
  - Deactivate confirm + reassign (2.9).
  - Permission editor reopen fix (B-E2).
- **Employee profile:**
  - Tabs: Doctors (assign / unassign), Chemists, Visits, Tour plan (M8).
  - Month tiles label fix (B-E3).
  - Directory paging (B-E4).
- **Documents:**
  - MR apne aur Manager team ke documents khol sakein (B-E1).
  - Image / PDF ka preview; error par message (chupke fail nahi).

### 3.12 Notifications
Actor ki photo; har notification ka link naye tabs par sahi; "aaj ke appointments" count fix (B-V11). Naye triggers sirf zaroori: visit correction, sample correction.

### 3.13 Settings
- Tabs: General · Territories · Audit log.
- Settings: free-text ki jagah samjhe hue fields — warehouse dropdown, attendance shift / grace, **visit back-date days**, **visit frequency per class** (B-H6).
- **Visit frequency targets (sirf Admin):** A = 3, B = 2, C = 1 visits / mahina default. Doctors ke data mein jo bhi class milti hai (A / B / C / CORE …) sabki list dikhegi, har ek ka target set ho sake; bina target wali class = 1. Coverage / frequency reports aur "Visit due" isi se chalenge.
- Audit log: paging + filters (B-H5).
- Manager ko grant karo to sach mein chale (B-H7).

### 3.14 Photos & design — har jagah
- Photos: audit section 4.3 ki ~25 jagah, Header bhi shared Avatar se.
- Dates: ek format (`04 Nov 2026`); paisa `₹1,23,456`.
- Har table: search + filters + paging; mobile par card view (Today, Doctors, Visits).
- Har modal: error modal ke andar (U4); success toast (U5).
- Empty state mein agla kadam ("Abhi koi visit nahi — [Log visit]") (U9).
- Loading: skeleton / BrandLoader (U8).
- Naam ek jaise (U10); Users table actions icon menu (U11).
- Animation sirf loader; rang brand tokens se.

---

## 4. Visit business rule — "completed visit kabhi delete nahi"

| | Kaise |
|---|---|
| **Delete** | Kisi role ke liye nahi. UI se button hatega; `DELETE /visits/:id` saaf error dega ("Completed visits cannot be deleted — use Correct visit"). Pehle se soft-deleted visits DB mein jaise hain waise rahenge (data nahi chhedenge). |
| **Correct visit** | Badal sakte: time, products discussed, notes, feedback, outcome, follow-up. **Reason zaroori.** MR: back-date window tak apne visit; uske baad / doosre ke visit: Manager (team) / Admin. Doctor badalna sirf Manager / Admin. |
| **Audit** | Har correction `audit_logs` mein (table pehle se hai — `before`, `after`, `reason`, kaun, kab). Visit details mein "Correction history". **Naya table nahi.** |
| **Sample correction** | Visit edit se stock **kabhi** nahi badlega. Alag action "Sample correction" (Manager / Admin): medicine, qty, "MR ke bag mein wapas" ya "write-off", reason → ledger mein `RETURN` / `ADJUSTMENT` entry, `refType = VISIT`. Visit details + ledger dono mein dikhe. |
| **Appointment** | Correction se kabhi reopen nahi. |
| **Audit report se badlav** | B-V1 ka purana hal ("delete par stock wapas") is rule se **badal gaya** — ab delete hi nahi, aur stock sirf explicit correction se. Purana decision #3 bhi isi se khatam. |

---

## 5. Meri salah — aapki list se aage (kyun useful)

| Idea | Kyun | Size |
|---|---|---|
| **Visit due / Last visit** (doctor list + Today) | MR ko pata chale aaj kisse milna zaroori hai — coverage apne aap badhegi | S |
| **Coverage, frequency, missed-doctor reports** | Pharma ke standard KPI; existing data se | M |
| **Manager "Team today" strip** | Subah ka pehla sawaal — kaun kaam par hai | S |
| **Admin "Data health" card** | Galat / adhura data khud dikhe | S |
| **Leave ↔ Tour plan warning** | Chhutti ke din calls planned na rahein | S |
| **Holidays + leave tour plan calendar par** | Plan banate waqt hi galti na ho | S |
| **Deactivate → reassign doctors** | Doctors kabhi "kho" na jaayein | S |
| **Retry-safe saves** (column pehle se hai) | Field mein net jaata-aata hai — double save nahi | S |
| **Location stamp on visit** (optional, columns pehle se hain) | Manager ko DCR par bharosa; block nahi karega | S |
| **End-of-day nudge** "3 calls log nahi hue" | MR din ka DCR poora kare | S |
| **Ek shared Doctor / Chemist picker** | Har jagah same info + search; bugs ek jagah fix | M |
| **Report date presets** | 90% reports "is mahina / pichhla mahina" hote hain | S |

**Baad mein (abhi nahi, socha hai):** area type (HQ / EX / OS) se DA apne aap bharna · offline mode · WhatsApp share of reports.

---

## 6. Database / API changes

**Sirf jodna (additive), kuch delete nahi.** Saari migrations idempotent, ek deploy ek baar.

| Change | Kyun | Phase |
|---|---|---|
| Table `doctor_chemists` (doctorId, chemistId, unique) | Doctor ↔ chemist link (M4) | P4 |
| Table `chemist_assignments` (doctor_assignments jaisa) | Chemist → MR (M5) | P4 |
| `visits.chemistId` par asli relation + index (column pehle se hai) | Chemist visit (M3) | P4 |
| `visits.offList` boolean (default false) + `offListReviewedAt`, `offListReviewedById` | Unlisted visit + Manager review (2.11) | P3 |
| `medical_stores.verificationStatus` (VERIFIED / PENDING / REJECTED, **default VERIFIED** — purane saare chemists verified) + `verifiedAt`, `verifiedById` | MR ke chemist ki verification (2.10) | P4 |
| Settings keys (schema nahi): `visit.backDateDays`, `visit.frequency.<class>` | Rules configurable | P3 / P5 |

**Migration safety (har migration):**
- Sirf `ADD TABLE` / `ADD COLUMN` (default ke saath) / `ADD INDEX` / `ADD FOREIGN KEY` — **koi DROP, RENAME, type change ya data delete nahi.**
- `IF NOT EXISTS` (dobara chale to bhi safe).
- Pehle realistic test DB par: migration se pehle aur baad har table ka row count + sample records compare.
- FK jodne se pehle check ki koi purani row toot to nahi rahi (e.g. `visits.chemistId` jo chemist exist na kare).

**Naye / badle APIs:**
- `POST /visits` · `POST /visits/bulk` (`dryRun` = preview) · `PATCH /visits/:id` (correction + reason) · `POST /visits/:id/sample-correction` · `GET /visits` filters + paging · `DELETE /visits/:id` → saaf error
- `POST /holidays/import` (`dryRun`)
- `GET /doctors?mrId&status&visitDue` · Manager team-scope writes · picker projections mein area / address
- `GET /stores` poori list / paging · `PATCH /stores/:id` (UI) · `GET /stores/:id/details` · `POST /stores/assign-mr` · `PUT / DELETE /doctors/:id/chemists/:chemistId`
- `PATCH /users/:id` (UI se pehli baar) · deactivate + reassign
- Reports: `coverage`, `frequency`, `missed-doctors`, `plan-vs-actual`
- Pehle se bane par unused APIs jo ab kaam aayenge: `GET /attendance/summary`, `GET /leaves/pending-count`, `GET /tour-plans/today`, `PATCH /medicines/:id`

**Abhi kuch delete nahi karenge** (aapki instruction): audit ke sanitize list mein se ab sirf wahi hatega jo **client-side, kahin import nahi, aur koi data / API nahi** — `Drawer.tsx`, `NotWiredYet.tsx`, unused UI helpers, Vite template files, 6 unused npm packages. Saare server routes, tables, columns abhi rahenge; unki cleanup list P8 ke baad migration-squash ke waqt alag approval ke liye.

**Backend permission (ab scope mein, kyunki aapne maanga):**
- Visits / appointments / settings / audit routes par `requirePermission`.
- Manager ka har list / write team tak (ek shared team-scope helper, poori hierarchy).
- Manager ko PAN / Aadhaar / bank API mein na aaye.
- MR sirf assigned doctor / chemist ka invoice bana sake.

---

## 7. Phases

Har phase ke end mein: **frontend build · backend build · lint · API regression script · Admin / Manager / MR browser test (desktop + mobile) · purana data / feature check** — phir aapko short report + screenshots, phir agla phase.

| Phase | Kya | Size |
|---|---|---|
| **P0 — Foundation** | **Realistic test DB + seed** (section 8); **API regression + Admin / Manager / MR ke asli browser workflows** (Edge, desktop + mobile) — aaj ki app ka baseline; dev `.env` fix (B-X3); saaf errors 400 / 409 instead of 500 (B-X1, B-X2, B-V3); medicine opening-stock transaction fix (audit test #34); modal ke andar error + toast (U4, U5); logout par cache clear (B-X4); safe client dead-code removal | M |
| **P1 — Attendance & Leave** | Naya module + 6 tabs (3.1); Overview; Approvals tab; holiday view sabko; leave preview + tour-plan warning; B-H1, B-H2, B-A1–A3; purane routes redirect | L |
| **P2 — Holiday import** | Import + preview + template + validation (2.8); B-H4; tour plan calendar par holidays / leave | M |
| **P3 — Visits + Today** | Log Visit (har darwaza), bulk, rules, no-delete + correction + sample correction, Today screen, Visits + Appointments tabs, filters / paging; B-V2–V14, M1, M2, M9, M10, M14, U1 (API), U13 | L |
| **P4 — Doctors & Chemists** | Combined module, chemist link / assign / profile / visit, doctor profile actions, shared picker, Manager team access, deactivate-reassign, doctor-delete cleanup; M3–M8, B-C1, B-D1–D10, U1–U3, U12, U14 | L |
| **P5 — Navigation, dashboards, reports** | Naya sidebar (1.1), baaki merges (Samples & Stock, Users & Access, Settings), mobile bottom bar, 3 role dashboards, reports rework + 3 naye reports; B-R1–R10, U15, M11, M13, B-E1–E4, B-H5–H7 | L |
| **P6 — Design & photos** | Photos har jagah, dates / currency, tables + mobile cards, empty / loading states, naming; U6–U11 | M |
| **P7 — Stock, Sales, permissions** | B-S1–S10, B-SL1–SL7, B-H3, M12, backend permission sweep (section 6) | M |
| **P8 — Final** | Poora regression (API + browser, 3 roles, mobile), final report: badli files, APIs, test results, baaki issues; schema-cleanup proposal (alag approval) | M |

P4 mein MR deactivate checklist (2.9) aur chemist verification (2.10) bhi; P3 mein unlisted review (2.11).

### 7.1 Har phase ke baad report (aur ruk jaana)
Har phase ke end mein `tests/results/<phase>/REPORT.md`:
1. **Kya bana / badla** — feature list.
2. **Changed files** — har file + ek line kyun.
3. **Test results** — build, lint, API checks (pass / fail count), browser workflows (role × flow × desktop / mobile).
4. **Failed cases** — kya fail hua, kyun, theek hua ya baaki.
5. **Screenshots** — har role ke main screens (report mein embedded, VS Code preview mein dikhenge).
6. **Data safety** — test DB par pehle / baad row counts.

**Aapke approval ke bina agla phase shuru nahi hoga.**

---

## 8. Testing kaise hoga

- **Test DB:** production jaisi saari migrations, PGlite (Docker ki zaroorat nahi). Realistic data: 1 Admin, 2 Manager (ASM + RSM), 4 MR, 40 doctors (kuch bina MR), 25+ chemists, medicines + stock, ek mahine ke visits / attendance / leave / holidays. Data asli APIs se banaya jaayega (taaki wahi code chale jo production mein chalta hai). **Production DB ko kabhi nahi chhuenge** — seed script sirf `127.0.0.1` wale DB par chalega.
- **Kahan:** repo mein naya `tests/` folder (apna `package.json`; client / server build aur Render deploy mein shamil nahi). Screenshots aur results `tests/results/` mein (gitignore).
- **"Complete" tab maanenge** jab build + API + **browser workflows teeno roles ke** pass hon. Jo browser mein fail ho, wo fail hai — chahe API pass ho.
- **API script:** audit wale 93 checks + har phase ke naye.
- **Browser:** installed **Microsoft Edge** ko `playwright-core` se chalayenge (koi naya browser download nahi). Har role se login karke asli clicks — form bharna, save, list mein dikhna, galat role ko button na dikhna. Desktop (1366 px) + mobile (390 px) screenshots; main khud dekh ke check karunga, zaroori screenshots aapko dikhaunga.
- **Data safety:** har phase ke pehle aur baad record counts compare — kuch gayab nahi hona chahiye.

---

## 9. Audit coverage — koi finding chhooti nahi

| Audit IDs | Phase |
|---|---|
| M1, M2, M9, M10, M14 · B-V1 (rule badla, section 4) · B-V2–V14 · U13 | P3 |
| M3, M4, M5, M6, M7, M8 · B-C1 · B-D1–D10 · U1, U2, U3, U12, U14 | P4 (U1 ka API hissa P3) |
| B-H1, B-H2, B-A1, B-A2, B-A3 · U8 (approvals) | P1 |
| B-H4 | P2 |
| B-R1–R10 · U15 · M11 · M13 · B-E1–E4 · B-H5, B-H6, B-H7 | P5 |
| Photos (audit 4.3) · U6, U7, U9, U10, U11 · U8 (baaki) | P6 |
| B-S1–S10 · B-SL1–SL7 · B-H3 · M12 · security items (audit section 9) | P7 |
| B-X1–X4 · U4, U5 · sanitize A (sirf client-safe hissa) | P0 |
| M15 (attendance selfie) | P1 mein optional — decision #9 |
| Sanitize B, C, D, E (schema / routes / docs) | P8 ke baad alag approval |
| Prisma upgrade, npm audit, migration squash, lint warnings | P8 (lint warnings P0 / P6 mein saath-saath) |

---

## 10. Decisions — final (approved)

| # | Sawaal | Final |
|---|---|---|
| 1 | Unassigned doctor ka visit | **Haan**, "Unlisted" tag · **auto-assign nahi** · Manager review + assign option (2.11) |
| 2 | Back-date window | Aaj + pichhle 2 din (MR); uske baad Manager / Admin · Settings se badal sakte |
| 3 | Manager team ke doctors / chemists | Add / edit / assign apni team ke; delete sirf Admin |
| 4 | MR chemist add | **Haan** + duplicate check + Manager verification (2.10) |
| 5 | Ek doctor / chemist → ek MR | Haan (abhi jaisa) |
| 6 | Global Approvals page | A&L Approvals + Expenses / Tour Plan tabs + Dashboard "Pending" card |
| 7 | MR home | Today (Dashboard + My Day ek) |
| 8 | Visit frequency | **Admin Settings**, default A = 3, B = 2, C = 1 |
| 9 | Weekly off | Sunday default; baaki WEEKLY_OFF holiday import se |
| 10 | Attendance selfie | Abhi nahi |
| 11 | Phase order | P0 → P1 (A&L) → P2 → P3 → … (aapka order) |
| 12 | MR deactivate | Checklist dialog (2.9) — stock khaali kiye bina nahi |
| 13 | Doctor profile invoice | Existing Sales / POB invoice form reuse |
| 14 | Migrations | Sirf additive; koi destructive change nahi |
