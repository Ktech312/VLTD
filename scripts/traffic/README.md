# Local request-count harness

Counts the requests the app makes to ITS OWN server (what the host bills as CDN/Edge requests) in a local production build, with the database replaced by a small simulated Supabase. Nothing leaves the machine: requests to any other host are failed and counted separately, and no production service is contacted.

Use it instead of automated sweeps against the live site (a fresh test browser has an empty cache, so each live page load costs 80-130 requests).

## Run
1. Simulated database (80 sample items by default, `SIM_ITEMS=300` for more):
   `npm run traffic:sim`
2. Build and start the app pointed at it (PowerShell: `$env:NAME="value"`; bash: `NAME=value cmd`):
   `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=simulated-anon-key SUPABASE_SERVICE_ROLE_KEY=simulated-service-key npx next build --webpack`
   then the same variables with `npx next start -p 3100`
   (`--webpack` because Turbopack refuses a node_modules junction/symlink; a normal checkout can use plain `next build`.)
3. Measure: `LABEL=after BASE=http://localhost:3100 npm run traffic:measure`
   Results go to `scripts/traffic/results/measure-<LABEL>.json` (override with `TRAFFIC_OUT`). `CHROME_PATH` overrides the Chrome location.

## What it measures
- cold: every route loaded in a fresh browser (requests by kind: page HTML, script chunk, stylesheet, font, image, API route, link prefetch).
- warm: six routes in one browser with a warm cache.
- idle: the public home page left open for 95 s (any recurring API calls show up here).
- prefetch: scrolling the Vault with 80 items.
- navigation: clicking header links (URL change and content-ready time, requests per navigation).
- back: scroll position and speed after opening an item and going Back.

Compare two builds by running the same harness against each (different ports) and diffing the JSON.

## Related
`scripts/local-tests/` holds browser regression tests that use the newer simulator `scripts/traffic/sim-supabase.cjs` (`npm run local:sim`, `npm run local:test`). The measurements in `results/` were taken with the original `fake-supabase.cjs`, which is kept unchanged so they stay reproducible.
When you build with the simulated address, set the variables in the build's environment: `.env.local` otherwise bakes the real database address into the bundle.
