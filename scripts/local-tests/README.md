# Local regression tests (no production traffic)

Browser tests that run a LOCAL production build of the app against a SIMULATED database (`scripts/traffic/sim-supabase.cjs`). Every request to a
non-local host is failed by the test browser, so nothing can reach the live site, the real database, or any paid service.

## Setup
1. `node scripts/traffic/sim-supabase.cjs` (port 54321; `SIM_PORT` to change). `GET /__sim/reset` restores the starting data.
2. Build the app pointed at it. The address must be set in the environment of the build, because `.env.local` otherwise wins and bakes the REAL database
   address into the bundle (this happened once: it was caught before any test ran):
   `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sim-anon-key npx next build --webpack`
   Afterwards check that your real Supabase host name appears nowhere under `.next/static` or `.next/server`.
3. `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sim-anon-key npx next start -p 3100`
   (make sure no older server still holds port 3100: a stale server serves an old build and breaks every page).
4. `node scripts/local-tests/run-all.cjs` (or one name fragment, e.g. `marketplace`). `BASE` overrides the app address; `CHROME_PATH` the browser.

## What is covered
seasonal theme switch · Lounge post / reply / vote / remove · Marketplace listings, prices, totals, sort, search, private-field exclusion ·
Add Item when photo storage refuses the upload · offline photo then recovery across reloads · Frame Studio on a new device · category Insights default window.
`routes-probe.cjs`, `corner-radii.cjs`, `fresh-device-sweep.cjs`, `reset-password-flow.cjs`, `share-and-recovery-flows.cjs` are inspection scripts (they print, they do not
all assert): run them with `ROUTES=dashboard,vault node scripts/local-tests/routes-probe.cjs` (no leading slash; Git Bash rewrites values that start with one).

## Simulator switches
`/__sim/fail?storage=1&msg=...` photo storage answers an error · `/__sim/fail?rest=1` every table call answers 503 · `/__sim/missing-col?names=a,b` answers 42703 for those
columns · `/__sim/seed` (POST `{table: rows}`) replaces tables · `/__sim/dump?table=x` · `/__sim/selects` last column list requested per table · `/__sim/counts`.

## Limits
The simulator answers the common PostgREST calls only; database functions (`rpc`) return nothing, row-level security and triggers do not exist, and the real
provider lookups (comics catalog, Kickstarter, Patreon, email, payments, AI) are not simulated. A pass here is a local pass, not proof about the live database.
