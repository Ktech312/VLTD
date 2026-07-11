# VLTD — Beta Signup/Onboarding Work — HANDOFF

Work done autonomously on 2026-07-11 while you were out. Everything below is committed
and pushed to `main` in small per-feature commits (easy to review/revert individually).

## What shipped (code complete)

1. **Beta consent gate** — "Request early access" now opens a consent modal with a required
   checkbox before the request submits. Records `consented_at`. (`PublicHomeClient.tsx`)
2. **"Opens email" bug** — root cause is a **stale production deploy**. Current code posts to
   `/api/waitlist` (no `mailto` anywhere). A fresh deploy fixes it. (see step 1 below)
3. **Admin waitlist + invite** — `/admin/waitlist` lists requests; "Approve & Invite" sends a
   Supabase invite email and stamps `invited_at`. (`/api/admin/waitlist`)
4. **Signup gated** — `/signup` is now invite-only messaging (no open account creation); routes
   people to the waitlist. Existing users still log in.
5. **Bug reporter** — floating bug button (logged-in only) → description + screenshot upload;
   reviewed at `/admin/bugs`.
6. **Onboarding fixed** — realistic preset avatars (not emoji), duplicate steps merged (4→3),
   and "Launch my vault" now completes reliably (the redesign had left Step 4's JSX outside the
   card so its errors were hidden; the `focused_universes` write is now best-effort so it can't
   abort finishing).

## YOU MUST DO THESE (I can't reach Vercel / Supabase / behind-login)

### 1. Confirm Vercel is deploying `main`
The live site (vltd.vercel.app) was serving pre-July-7 code. Confirm the latest push deployed.
Once deployed, the early-access form stops opening email and posts to the API.

### 2. Vercel → Settings → Environment Variables (Production)
- `SUPABASE_SERVICE_ROLE_KEY` — **required** for the waitlist, invites, and bug admin. If missing,
  the waitlist returns 503 (this is the earlier live failure). It IS set locally in `.env.local`.
- `NEXT_PUBLIC_OWNER_EMAIL` — your email, so you can open `/admin/waitlist` and `/admin/bugs`.
- `NEXT_PUBLIC_SITE_URL` — e.g. `https://vltd.vercel.app` (used for invite redirect links).

### 3. Run these SQL migrations in Supabase (SQL editor)
- `supabase/migrations/20260711_beta_waitlist_consent.sql`  (adds `consented_at`)
- `supabase/migrations/20260711_bug_reports.sql`  (bug_reports table + `bug-screenshots` bucket + policies)
- Verify `profiles.focused_universes` exists (onboarding writes it, best-effort):
  `alter table public.profiles add column if not exists focused_universes text[];`

### 4. Supabase Auth settings (true invite-only)
- **Disable signups** (Authentication → Sign In / Providers): blocks public `signUp` at the source.
  Admin invites still work. The `/signup` UI already shows invite-only, but this enforces it.
- Customize the **"Invite user"** email template. Invite links redirect to `/reset-password`
  (where the invited user sets a password) — verify that path end-to-end.
- Note: Supabase's built-in email sender is rate-limited; add SMTP for real volume.

### 5. Verify behind-login flows live (I couldn't — they're gated)
- **Onboarding:** fresh account → realistic avatars, 3 steps, "Launch my vault" lands you in the app.
- **Invite:** approve someone on `/admin/waitlist` → they receive the email → link works.
- **Bug reporter:** logged in → floating bug icon (bottom-right) → submit w/ screenshot → shows in `/admin/bugs`.

### 6. Cleanup test data
Delete my diagnostic rows from `beta_waitlist` where email ends in `@vltd-test.local`
(`debug-check@`, `browser-fetch@`, `walkthrough@`, `consent-test@`).

## Notes / your call
- **Consent copy** is live in the modal (`PublicHomeClient.tsx`) — edit wording anytime.
- Invited users land on `/reset-password` to set a password. If you'd prefer a branded "Welcome —
  set your password" page, say so and I'll build one.
- `signUpWithPassword` / `signInWithGoogle` in `src/lib/auth.ts` are now unused by `/signup`
  (kept in case you want them for a future non-beta flow).
