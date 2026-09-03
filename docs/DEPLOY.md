# Deploy — Render

Live services (URLs do **not** match the service names in `render.yaml`; Render
appended suffixes when they were created):

| What | URL |
|---|---|
| API | `https://pharma-mr-crm.onrender.com` |
| Frontend | `https://pharma-mr-crm-1.onrender.com` |
| DB | Neon Postgres (`DATABASE_URL`, set in the dashboard) |

---

## Is `render.yaml` even being used?

Only if the services were created by **applying this Blueprint**. If they were
created by hand in the dashboard, Render ignores `render.yaml` entirely.

Quick test:

```bash
curl -s https://pharma-mr-crm.onrender.com/health
```

If the response says `"env":"development"` while `render.yaml` sets
`NODE_ENV=production`, the file is being ignored — configure everything in the
dashboard instead (below).

---

## Dashboard settings that must be right

### API service (`pharma-mr-crm`)

| Setting | Value | Why |
|---|---|---|
| Start Command | `npm run db:deploy && npm start` | Free plan ignores `preDeployCommand`, so migrations must run at boot |
| Build Command | `npm install && npm run build` | |
| Root Directory | `server` | |
| Health Check Path | `/health` | |
| `NODE_ENV` | `production` | the refresh cookie only gets `Secure` + `SameSite=None` in production, and the frontend is a different origin |
| `CORS_ORIGIN` | `https://pharma-mr-crm-1.onrender.com,http://localhost:5173` | |
| `APP_TIMEZONE_OFFSET_MINUTES` | `330` | IST; every attendance/leave day derives from it |
| `DATABASE_URL` | the Neon connection string | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 32+ chars each | |

### Frontend service (`pharma-mr-crm-1`)

| Setting | Value | Why |
|---|---|---|
| Build Command | `npm install && npm run build` | |
| Root Directory | `client` | |
| Publish Directory | `dist` | |
| `VITE_API_BASE_URL` | `https://pharma-mr-crm.onrender.com/api/v1` | **Vite inlines this at build time.** Without it the client falls back to the relative `/api/v1`, which hits the static host and returns `Not Found` — login cannot work |
| Redirects/Rewrites | Source `/*` → Destination `/index.html` → Action **Rewrite** | otherwise reloading `/login` returns 404 |

> Changing `VITE_API_BASE_URL` needs a **rebuild**, not just a restart — the
> value is baked into the JS bundle.

---

## The three failures this setup has hit

### 1. Login returns 500 — "column `mr_profiles.designation` does not exist"

The database was originally created with `prisma db push`, so it has tables but
no `_prisma_migrations` history. Plain `prisma migrate deploy` refuses to run on
that:

```
Error: P3005 — The database schema is not empty.
```

So the migration never applied, while the new code expects the new columns.

**Fix (already in the repo):** `npm run db:deploy`
(`server/scripts/db-deploy.cjs`) baselines the history once, then migrates and
seeds. It is idempotent — later deploys are a no-op. Put it in the API service's
Start Command.

One-time manual alternative, from your machine with `DATABASE_URL` pointing at
Neon:

```bash
cd server
npm run db:deploy
```

### 2. Login does nothing / network error

`VITE_API_BASE_URL` was never set, so the built bundle called `/api/v1` on the
static host. Set it on the frontend service and **redeploy** (rebuild).

### 3. Reloading `/login` returns "Not Found"

A static host serves files; `/login` is not a file, so it 404s unless the host is
told to fall back to `index.html`.

**Render does not support Netlify-style `_redirects`.** The repo used to carry
`client/public/_redirects`; it was published as a normal asset and had no effect —
you can prove it by fetching it:

```bash
curl -s https://pharma-mr-crm-1.onrender.com/_redirects
# 200 with the file's text = it is just a public file, not routing config
```

It has been deleted to stop it looking like the problem was handled.

Render offers exactly two working options:

**Option A — dashboard rule (use this if the services were made by hand):**

> Static site `pharma-mr-crm-1` → **Redirects/Rewrites** → **Add Rule**
> - Source: `/*`
> - Destination: `/index.html`
> - Action: **Rewrite** (not Redirect)

**Option B — let the Blueprint own the services**, so the `routes` block in
`render.yaml` applies. Note this only works if the services are Blueprint-managed;
if `GET /health` reports `"env":"development"` while `render.yaml` sets
`NODE_ENV=production`, they are not, and `render.yaml` is being ignored entirely.

Verify after either fix:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://pharma-mr-crm-1.onrender.com/login
# 200, not 404
```

---

## Deploy order after a schema change

1. Push to the branch Render tracks (check the dashboard — the work has been on
   `develop`, while `origin/HEAD` points at `main`).
2. API service deploys → Start Command runs `db:deploy` → migration + seed.
3. Frontend service rebuilds with `VITE_API_BASE_URL` inlined.
4. Verify:

```bash
curl -s https://pharma-mr-crm.onrender.com/health
# expect {"success":true,...,"env":"production"}

curl -s -X POST https://pharma-mr-crm.onrender.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"probe@nonexistent.local","password":"wrong"}'
# expect 401 UNAUTHORIZED — a 500 here means the schema is still behind

curl -s -o /dev/null -w '%{http_code}\n' https://pharma-mr-crm-1.onrender.com/login
# expect 200, not 404
```

---

## Free-plan gotchas

- `preDeployCommand` needs a paid instance type. On free it never runs.
- The API sleeps after inactivity; the first request can take ~50s. A login that
  "hangs" once may just be a cold start.
- One instance only, so running migrations in the Start Command cannot race.
