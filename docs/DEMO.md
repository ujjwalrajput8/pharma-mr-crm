# Field Force Panel — Client Demo Guide

Jovance Laboratories / Pharma MR CRM  
**One web app** — Admin · Manager (ASM/RSM) · MR same login, same layout. Menus change by **role + permissions**.

---

## 1. Demo se pehle (aapke machine pe)

### Start

```bash
# Repo root
docker compose up -d

# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

| Service   | URL |
|-----------|-----|
| Frontend  | http://localhost:5173 (kabhi 5174 — Vite terminal dekho) |
| API       | http://localhost:4000 |
| Health    | http://localhost:4000/health |

DB seed (sirf **admin + role permissions** — baaki data touch nahi):

```bash
cd server
npx prisma migrate deploy
npm run prisma:seed
```

Setup detail: [SETUP.md](./SETUP.md)

---

## 2. Demo login accounts

Seed **sirf bootstrap** hai — Admin login, role permissions, attendance config aur ek
Main Warehouse. **Koi business data nahi banata** (na doctor, na product, na attendance,
na leave type, na holiday) kyunki wahi seed production pe bhi chalti hai.

**Manager aur MR dono Users & Hierarchy se bante hain** (role dropdown + "Reports to"
dropdown). Leave types aur holidays Admin **Leave Policy** aur **Holiday Calendar** se
banata hai — ye pehla setup step hai, warna MR leave apply nahi kar payega.

| Role | Email | Password | Client ko kya dikhana |
|------|--------|----------|------------------------|
| **Admin** | `admin@pharma-mr.local` | `Admin@12345` | Masters, users, employees, leave policy, holidays, reports |
| **Manager / MR** | (UI se create) | (jo set karo) | Team / field workflows |

**Order:** pehle Manager banao → phir MR banao aur uska "Reports to" us Manager pe set karo.
Team scoping isi hierarchy se chalti hai — Manager ko sirf apni reporting line dikhti hai.

Extra MRs (same password `Mr@12345`):

- `priya.mr@jovance.local`
- `amit.mr@jovance.local`

**Tip:** Chrome mein 3 Incognito / 3 profiles — Admin / Manager / MR parallel open rakho.

---

## 3. Client ko pehle ye story bolo (30 sec)

> Yeh **Field Force Panel** hai — Medical Representative field force manage karne ke liye.  
> Alag Admin app / alag MR app nahi.  
> **Ek website**, teen roles. Sidebar usi hisaab se dikhta hai jo permission hai.  
> Stock **ledger** se chalta hai (transaction history) — quantity seedha edit nahi hoti.

---

## 4. Demo script (~10–12 minutes)

### Step A — Admin (≈4 min)

Login: `admin@pharma-mr.local` / `Admin@12345`

| Menu | Yahan se kya manage hota hai |
|------|------------------------------|
| **Dashboard** | Overall snapshot |
| **Users & Hierarchy** | MR accounts create / activate / deactivate / password reset |
| **Manager Access** | Kis Manager ko kaun-kaun si permission (defaults + custom) |
| **Doctors** | Doctor master + MR assignment |
| **Chemists / Stores** | Chemist / stockist master |
| **Products** | Medicine / product master |
| **Stock Balances / Issue to MR / Ledger** | Warehouse stock, MR ko issue, ledger history |
| **Attendance** | Sabki attendance + monthly register calendar + Late/Absent/Leave correction |
| **Employees** | Har employee ka pura record: joining, leave balance, attendance, field activity |
| **Holiday Calendar** | Saal ke holidays (leave count inse skip hota hai) |
| **Leave Policy** | Leave types + quota + per-employee entitlement |
| **Reports / Sales** | Commercial overview |
| **Settings / Audit Log** | Company settings, system audit |

**Bolna:** Admin company-level control karta hai. Khud field check-in / My Day nahi karta.

#### Permission demo (must show)

1. Sidebar → **Manager Access**
2. Manager **Ankit Shah (ASM)** → **Edit**
3. Kuch permissions hatao (example: Stock / Ledger)
4. **Save permissions**
5. Logout → Manager se login
6. Sidebar mein woh menus **nahi** dikhenge
7. Wapas Admin → **Reset defaults** → Manager dubara login → defaults wapas

> Manager ko permission change ke baad **logout → login** karna hota hai.

---

### Step B — Manager / ASM (≈3 min)

Login: `asm.west@jovance.local` / `Manager@12345`

| Menu | Yahan se kya manage hota hai |
|------|------------------------------|
| **Approvals** | Team ke pending leave requests + flagged check-ins (real data) |
| **Leave** | Apna leave + team ka leave approve / reject |
| **Attendance** | Apna check-in + team register + Late / Absent correction |
| **Tour Plan** | Team tour plan approve / manage |
| **Appointments / Visits** | Team field activity |
| **Issue to MR / Stock** | MR ko sample stock dena |
| **Reports / Sales** | Team commercial view |
| **My Day / My Stock** | Manager bhi field pe ho to apna day / stock |

**Bolna:** Manager Admin jaisa pura system nahi chalata — sirf **apni team**. Kitna access milega, Admin **Manager Access** se decide karta hai.

---

### Step C — MR (≈3 min)

Login: `rahul.mr@jovance.local` / `Mr@12345`

| Menu | Yahan se kya manage hota hai |
|------|------------------------------|
| **My Day** | Aaj ka field plan / focus |
| **Attendance** | GPS check-in / check-out + apna monthly register |
| **Leave** | Leave apply + balance (kitna bacha hai) |
| **Tour Plan** | Apna monthly tour plan |
| **Appointments** | Doctor appointments |
| **Visits / DCR** | Visit entry (appointment ke baad) |
| **My Stock** | Apne paas kitna sample stock |
| **Sample Given** | Visit pe sample diya |
| **Sales / Reports** | Apna POB / own reports |

**Bolna:** MR ko Users, Manager Access, Settings, Audit **nahi** milte. Sirf apna field kaam.

---

## 5. Business flow (client ko end-to-end story)

```text
Admin / Manager
  → Products + Doctors setup
  → Stock warehouse pe
  → Issue to MR (ledger txn)
  → (Optional) Create appointment & assign to MR

MR / Manager
  → Attendance check-in
  → Own appointment (ya Admin/Manager ne assign kiya)
  → Visit / DCR
  → Sample given (stock ledger se kam)

Manager
  → Team appointments / Approvals / Attendance review

Admin
  → Saari appointments + Created by / Assigned by
  → Reports + Audit
```

### Appointments — who sees what

| Role | Create | List / Calendar | Created by / Assigned by columns |
|------|--------|-----------------|----------------------------------|
| **Admin** | Assign to any MR | All | Yes |
| **Manager** | Self or team MR | Team + self | Yes |
| **MR** | Self only | Own only | Hidden (details still show) |

**Reschedule:** Pending / Rescheduled appointments — list pe **Reschedule**, details pe button, ya Dashboard calendar pe drag. Status `RESCHEDULED` ho jati hai.

**Stock rule (ek line):**  
Quantity seedha change nahi — har movement `stock_txns` ledger mein record hoti hai.

---

## 6. Roles — short comparison

| Capability | Admin | Manager | MR |
|------------|:-----:|:-------:|:--:|
| Users / accounts create | Yes | No* | No |
| Manager permissions | Yes | No | No |
| Team approvals (leave, flags) | Yes | Yes | No |
| Own My Day / check-in | No | Yes | Yes |
| Apply for own leave | No | Yes | Yes |
| Approve team leave | Yes | Yes* | No |
| Manage team attendance | Yes | Yes* | No |
| Employee profiles | All | Own team* | Only own |
| Edit HR record (PAN, bank) | Yes | No | No |
| Holiday calendar / leave policy | Yes | No | No |
| Issue stock to MR | Yes | Yes* | No |
| Own visits / samples | No | Optional* | Yes |
| Settings / Audit | Yes | No | No |

\* = default Manager permissions; Admin **Manager Access** se badal sakta hai.

---

## 7. Client ke common questions

**Q. Alag Admin panel aur MR app?**  
A. Nahi. Ek Field Force panel. Role + permission se menus.

**Q. Manager ko control kaun deta hai?**  
A. Admin → **Manager Access**. Defaults pehle se; custom bhi.

**Q. Stock galat edit ho sakta hai?**  
A. Design: append-only ledger. History rehti hai.

**Q. Mobile / offline?**  
A. Ab web panel. Mobile / offline next phase.

**Q. Leave kaise chalti hai?**
A. MR apply karta hai → reporting Manager approve karta hai → un working days ki attendance
apne aap **LEAVE** mark ho jaati hai aur balance kam ho jaata hai. Sunday aur holiday count
nahi hote. Approved leave wale din manager direct edit nahi kar sakta — pehle leave cancel
karni padegi (register aur leave ledger kabhi alag nahi hote).

**Q. Leave quota kaun set karta hai?**
A. Admin → **Leave Policy**. Type-wise quota, aur zarurat ho to per-employee entitlement
(opening + granted) override.

**Q. Fake GPS / galat check-in?**
A. Check-in block nahi hota — **flag** hota hai (mock location, kharab accuracy, device clock
mismatch) aur Manager ke **Approvals** inbox mein review ke liye aa jaata hai.

**Q. Kitne roles?**  
A. ADMIN · MANAGER (ASM/RSM) · MR.

---

## 8. Demo checklist (print / keep open)

- [ ] Docker + server + client running
- [ ] `npx prisma migrate deploy` + `npm run prisma:seed` chal gaya
- [ ] Health OK (`/health`)
- [ ] Admin login → Users & Hierarchy se **Manager** banao, phir uske under **MR**
- [ ] **Manager Access** customize → Manager sidebar change
- [ ] MR se **Leave apply** → Manager se **approve** → Attendance register pe LEAVE dikhao
- [ ] MR ka **Employees → profile** kholo: leave balance + attendance + field activity
- [ ] **Holiday Calendar** mein ek holiday add karke leave day-count pe asar dikhao
- [ ] MR **GPS check-in** → flag aaye to Approvals inbox dikhao
- [ ] Stock / Ledger ek baar open karke "ledger" concept bolo
- [ ] Logout/login se role switch clear dikhao

---

## 9. Quick URLs (local)

| Page | Path |
|------|------|
| Login | `/login` |
| Dashboard | `/dashboard` |
| Users & Hierarchy | `/users` |
| Manager permissions | `/manager-permissions` |
| Employees | `/employees` |
| Employee profile | `/employees/:id` |
| Attendance | `/attendance` |
| Leave | `/leave` |
| Leave policy | `/leave-policy` |
| Holiday calendar | `/holidays` |
| Approvals | `/approvals` |
| My Day | `/my-day` |
| Ledger | `/ledger` |

---

## 10. First-run setup (naya deploy ke baad, isi order mein)

Seed business data nahi banata, to demo se pehle ye karo:

1. **Leave Policy** → leave types add karo (CL 12, SL 12, EL 15…)
2. **Holiday Calendar** → saal ke holidays add karo (leave count inse skip hota hai)
3. **Users & Hierarchy** → pehle Manager, phir uske under MR (+ "Reports to")
4. **Employees** → har employee ka HR record complete karo (joining date, PAN, bank)
5. **Products / Doctors / Chemists** → masters
6. **Issue to MR** → MR ke bag mein sample stock

---

## 11. Abhi backend se connected nahi (client ko saaf bolo)

Ye chaar screens ab **fake data nahi dikhati** — saaf "backend not connected" panel
dikhati hain, jisme likha hai kya aayega aur kya pehle se ready hai:

- **Tour Plan** — DB models ready hain, API + planning grid baaki
- **My Day** — call list approved tour plan se aayegi
- **My Stock** — per-MR balance endpoint baaki (balances DB mein hain)
- **Ledger Explorer** — stock_txns likhi ja rahi hai, read query baaki

Roadmap: **TA/DA expense claim, RCPA, target-vs-achievement, photo upload,
notifications, offline PWA**.

---

*Internal demo notes — Jovance Field Force panel.*
