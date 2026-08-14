# Pharma MR CRM — Local Setup

## Prerequisites

- Node.js 20+
- Docker Desktop running (PostgreSQL)

## 1. Start database

```bash
docker compose up -d
```

## 2. Configure server env

```bash
cp server/.env.example server/.env
```

Ensure `DATABASE_URL` points to localhost:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pharma_mr_crm
```

## 3. Migrate + seed Admin

```bash
cd server
npm install
npx prisma migrate deploy
npm run prisma:seed
```

Default Admin (from env):

- Email: `admin@pharma-mr.local`
- Password: `Admin@12345`

## 4. Run apps

From repo root:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health: http://localhost:4000/health

## Architecture notes

- Single app shell for Admin and MR
- RBAC on frontend (nav/routes) and backend (middleware)
- JWT access token + httpOnly refresh cookie
- Prisma repositories only; services own business rules

## Render / production deploy (server)

Root directory: `server`

| Setting | Value |
|---------|--------|
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Release (schema) | `npx prisma db push` *(no full migrate history yet)* |

Required env: `DATABASE_URL`, JWT secrets, etc. (see `.env.example`).

Build runs `prisma generate && tsc`. Client imports use `@prisma/client` (not a gitignored `generated/` folder).
