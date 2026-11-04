# Local regression tests

Throwaway database + realistic data + API checks + real-browser workflows.
**Never touches the production or dev database**, and is not part of the
client / server builds or the Render deploy.

## One-time setup

```powershell
cd tests
npm install
```

You also need Microsoft Edge installed (the browser tests drive it headless).

## Run — one command

```powershell
cd tests
node run-all.mjs                 # fresh DB → migrations → API → web → seed → API checks → browser
$env:TEST_PHASE='P1'; node run-all.mjs   # keep each phase's results apart
```

Ports 54329 / 4100 / 5174 must be free; everything is stopped at the end.

## Run — step by step (4 terminals)

```powershell
# 1. Empty in-memory Postgres on 127.0.0.1:54329
cd tests; node db.mjs

# 2. Migrations + Admin login, then the API on :4100
cd server
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable'
$env:ADMIN_EMAIL='admin@test.local'; $env:ADMIN_PASSWORD='Admin@12345'
node scripts/db-deploy.cjs
$env:PORT='4100'; $env:JWT_ACCESS_EXPIRES_IN='4h'; $env:CORS_ORIGIN='http://localhost:5174'
npx tsx src/server.ts

# 3. The web app on :5174, pointed at that API
cd client
$env:VITE_API_BASE_URL='http://localhost:4100/api/v1'
npx vite --port 5174 --strictPort

# 4. Data, then the checks
cd tests
node seed.mjs      # 6 people, 40 doctors, 26 chemists, stock, leave, tour plans, visits…
node api.mjs       # API regression
node browser.mjs   # Admin / Manager / MR in Edge, desktop + phone
```

Results land in `tests/results/<phase>/` (`api.json`, `browser.json`,
`counts.json`, `screens/*.png`). Set `TEST_PHASE=P1` etc. to keep phases apart.

**Logins** (all passwords `Passw0rd!`, Admin `Admin@12345`):
`admin@test.local` · RSM `vikram.rsm@test.local` · ASM `amit.asm@test.local` ·
MRs `rahul.mr@test.local`, `neha.mr@test.local`, `sanjay.mr@test.local`, `pooja.mr@test.local`.

Result status: **PASS** · **FAIL** (a real problem in this phase) · **KNOWN**
(an audit bug that a later phase fixes — see `IMPROVEMENT_PLAN.md` §9).
