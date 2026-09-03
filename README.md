# Pharma MR CRM — Jovance Laboratories

Field-force CRM for **JOVANCE LABORATORIES PVT. LTD.** — one web app for Admin, Manager (ASM/RSM)
and Medical Representative.

Built with React, TypeScript, Node.js, Express, Prisma and PostgreSQL.

## Tech Stack

### Frontend

* React + TypeScript + Vite
* React Router + TanStack Query
* Tailwind CSS, FullCalendar, react-day-picker

### Backend

* Node.js + Express + TypeScript
* Prisma ORM + PostgreSQL
* JWT authentication (access token + httpOnly refresh cookie)

## Project Structure

```text
pharma-mr-crm/
├── client/          # React SPA (Admin + Manager + MR, single app)
├── server/          # Express API (Clean Architecture layers)
├── docker/          # pgAdmin config
├── docs/            # Setup + demo notes
└── docker-compose.yml
```

## Features

* One login / one layout / one sidebar — menus filtered by **role + permission**
* Three roles: `ADMIN`, `MANAGER` (ASM/RSM), `MR`, with a reporting hierarchy
* Permissions enforced on **both** sides — the sidebar hides them, `requirePermission`
  rejects them, and effective permissions are re-resolved on every request
* Masters: doctors (with MR assignment), chemists / stockists, products, batches
* Field: appointments → visit / DCR, samples only during a visit
* **Attendance**: GPS check-in / check-out, late detection against a configurable shift,
  flagged check-ins (mock location, poor accuracy, device-clock skew), monthly register
* **Leave**: leave-type policy with quota, apply → manager approval → attendance
  auto-marked, per-year balances, half days, carry-forward
* **Holiday calendar**: company / regional holidays; excluded from leave day-count
* **Employee profiles**: employment, personal, statutory + bank, leave balance,
  attendance register and field activity in one screen
* Stock as an **append-only ledger** (`stock_txns`); balances are a rebuildable rollup
* Reports, settings and an audit log

## Installation

```bash
npm install
cd client && npm install
cd ../server && npm install
```

See [docs/SETUP.md](docs/SETUP.md) for database migrate + seed steps.

## Run

```bash
docker compose up -d
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/health

Default Admin (seed): `admin@pharma-mr.local` / `Admin@12345`

### Seed policy

`npm run prisma:seed` is a **bootstrap seed** and is safe to run on every deploy. It
writes only what the app cannot boot without, and is idempotent:

| Created | Why |
|---|---|
| Role default permissions | RBAC would deny everything otherwise |
| The Admin login | first way into the app |
| Attendance / leave config keys | shift start, late grace, GPS accuracy threshold |
| One warehouse + `stock.default_warehouse_id` | Stock and Products screens fail without it |

It deliberately creates **no business data** — no doctors, chemists, products,
appointments, visits, attendance, sales, leave types or holidays. Those are customer
records and are created from the UI (Users & Hierarchy → Leave Policy → Holiday
Calendar → masters). Never add demo rows to `prisma/seed.ts`: it runs against
production.

## Timezone

Every day-granular value (attendance day, leave day) is derived from
`APP_TIMEZONE_OFFSET_MINUTES` (default `330` = IST). Do not compute "today" from a raw
`toISOString()` — use `server/src/utils/datetime.ts`.

Client demo walkthrough (Admin / Manager / MR): [docs/DEMO.md](docs/DEMO.md)

## License

For learning and development purposes.
