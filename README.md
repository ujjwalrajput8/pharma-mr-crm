# Pharma MR CRM — Jovance Laboratories

Medical Representative (MR) Management System for **JOVANCE LABORATORIES PVT. LTD.**

Built with React, TypeScript, Node.js, Express, Prisma, and PostgreSQL.

## Tech Stack

### Frontend

* React + TypeScript + Vite
* React Router + TanStack Query
* Tailwind CSS

### Backend

* Node.js + Express + TypeScript
* Prisma ORM + PostgreSQL
* JWT Authentication (access + httpOnly refresh cookie)

## Project Structure

```text
pharma-mr-crm/
├── client/          # React SPA (Admin + MR, single app)
├── server/          # Express API (Clean Architecture layers)
├── docker/          # pgAdmin config
├── docs/            # Setup notes
└── docker-compose.yml
```

## Features

* One Login / One Layout / One Sidebar / One Dashboard
* Role-Based Access Control (Admin & MR)
* Doctor, Store, Medicine, Appointment, Visit modules
* Visit requires Appointment; samples only during Visit
* Automatic stock decrement on sample distribution
* Reports, Stock adjustments, Settings, Audit logs

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

Client demo walkthrough (Admin / Manager / MR): [docs/DEMO.md](docs/DEMO.md)

## License

For learning and development purposes.
