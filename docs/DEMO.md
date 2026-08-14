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

DB seed / reset chahiye ho to (sirf **admin + role permissions** — baaki data touch nahi):

```bash
cd server
npx prisma db push
npm run prisma:seed
```

Setup detail: [SETUP.md](./SETUP.md)

---

## 2. Demo login accounts

Seed se sirf Admin banta hai. Manager / MR aap Users se create karo.

| Role | Email | Password | Client ko kya dikhana |
|------|--------|----------|------------------------|
| **Admin** | `admin@pharma-mr.local` | `Admin@12345` | Masters, users, Manager permissions, reports |
| **Manager / MR** | (UI se create) | (jo set karo) | Team / field workflows |

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
| **Attendance** | Sabki attendance dekhna + Late / Absent manage |
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
| **Approvals** | Team ke pending approvals inbox |
| **Attendance** | Apna check-in + team Late / Absent mark |
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
| **Attendance** | Apna check-in (GPS fields) |
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
| Users / MR create | Yes | No* | No |
| Manager permissions | Yes | No | No |
| Team approvals | Yes | Yes | No |
| Own My Day / check-in | No | Yes | Yes |
| Manage team attendance | Yes | Yes | No |
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

**Q. Kitne roles?**  
A. ADMIN · MANAGER (ASM/RSM) · MR.

---

## 8. Demo checklist (print / keep open)

- [ ] Docker + server + client running
- [ ] Health OK (`/health`)
- [ ] Admin login + Users page
- [ ] **Manager Access** customize → Manager sidebar change
- [ ] Manager attendance / approvals dikhao
- [ ] MR My Day + Attendance + Visits dikhao
- [ ] Stock / Ledger ek baar open karke “ledger” concept bolo
- [ ] Logout/login se role switch clear dikhao

---

## 9. Quick URLs (local)

| Page | Path |
|------|------|
| Login | `/login` |
| Dashboard | `/dashboard` |
| Users (MR) | `/users` |
| Manager permissions | `/manager-permissions` |
| Attendance | `/attendance` |
| My Day | `/my-day` |
| Ledger | `/ledger` |

---

*Internal demo notes — Jovance Field Force panel.*
