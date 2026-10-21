# Batch 6 closeout (priority 1: false "saved" results and exposure), 2026-10-20

All fixes are on production (commits `9c4bcc8`, `29e18cb`, `67d037e`, `86ed798`, `cad5cc5`) and re-tested there with isolated QA accounts
(owner A, unrelated account B, unfinished-onboarding user C, a signed-out visitor). Nothing touched a real person's data.
Script: `scripts/rb23-batch6.cjs` (17 checks, rows RB23-001..017) and `scripts/rb24-verifyage.cjs` (4 checks, RB24-001..004). 21 of 21 pass; evidence in `evidence/` and `shots/rb23-*`, `shots/rb24-*`.

| ID | What changed | Direct production check |
|---|---|---|
| RC-08 | `/admin/themes` and `/studio` sit behind `AdminGate` (admin role + completed second factor); everyone else sees only "You don't have access to this page." and the page's own code is not mounted | visitor and signed-in non-admin on both pages: RB23-001..004 |
| RC-33 | `/api/vault/[id]` needs a valid Supabase bearer token; in-memory store capped at 200 | anonymous/bad token POST+DELETE: 401 x4; signed-in: 200 x2 (RB23-005, 006) |
| RC-04 | A failed sign-out request returns an error; TopNav shows "Couldn't sign you out ... You are still signed in." and keeps the session; other callers (Sign out everywhere, admin screens) behave the same; a successful sign-out is unchanged | request really refused by the harness, then allowed: RB23-015, 016 |
| RC-07 / RC-28 | `/account`: empty display name, usernames under 3 / over 24 characters, with spaces or symbols, or starting/ending with `_` are refused before anything is sent, saved profile unchanged; a taken username says "That username is already taken. Try a different one." (also onboarding step 1); a valid change still saves | RB23-007..011, 017 |
| RC-28 | `/museum/new`: double-click creates one exhibition; title capped at 80 like the editor; the disabled Create says a title is needed | RB23-012..014 |
| RC-28 | Verify Age says "Not saved yet. Press Save ..." until Save; a failed save on that card is red | RB24-001..004 |

## Not verified / limits (stated plainly)
- RC-08: the admin-positive path (a real admin with a verified second factor still sees Themes and Studio) was not exercised on production. It uses the same `getMyAdminAccessStatus` rule that gated `/admin/characters` in batch 5. No disposable admin role was created for this.
- RC-04: the push-notification release on sign-out happens before the sign-out request; if the request then fails, that device stops receiving pushes until it is registered again. Recorded as a minor side effect, not changed.
- Username limits (3 to 24) are checked only when the username is being changed, so existing longer names can still save other profile fields. The `/account` field keeps its live clean-up to letters, numbers and underscores.
- Onboarding step 1 uses the shared "taken" wording; the same call is used by `/account` and both were checked.
- Fixtures: rb23 dropped and recounted (3,477 items, 0 QA profiles, exhibitions, events, sales or users left). rb24 kept for the next batch and dropped at its end.
