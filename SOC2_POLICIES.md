# VLTD — SOC 2 Phase 1 Policies (draft, 2026-08-25)

Drafted per the plan in `SOC2_ROADMAP.md`. These are short on purpose —
real, followable documents, not legal filler. Every place that needs a
decision only EK can make is marked **[EK: ...]** instead of guessed at.
Read these, edit anything that's wrong or missing, and they're usable
immediately — you don't need a formal audit underway to start actually
following them.

None of this has been run past a lawyer or a real auditor. Treat it as a
strong first draft, not a finished, certified policy set.

---

## 1. Information Security Policy (the umbrella document)

**Purpose.** This describes how VLTD protects the data collectors trust it
with — vault item records, images, account information, and payment data
(handled by Stripe, never stored directly by VLTD).

**Scope.** Applies to the VLTD web application, its Supabase database and
storage, its Vercel hosting, and everyone with administrative access to
any of them.

**Where things run:**
- **Vercel** hosts the application (Next.js) and its serverless API
  routes. Deploys happen automatically on every push to the `main`
  branch — there's no separate staging environment today.
- **Supabase** hosts the Postgres database, handles user authentication,
  and stores uploaded images/documents in Storage buckets.
- **Stripe** handles all payment processing. VLTD never stores card
  numbers or bank details directly.
- **Anthropic** provides the AI vision used for scanning/identifying
  items (Quick Add, bulk scan, AI Assist).

**Core commitments:**
- Every table containing user data has Row Level Security (RLS) enabled
  — the database itself enforces who can read/write which rows, not just
  the application code. This was audited end-to-end 2026-08-23/24 (see
  `HANDOFF.md`) and 8 real gaps were found and closed.
- Administrative access (the ability to grant tiers, view all users,
  enable features for specific accounts, etc.) is restricted to a short,
  explicit allowlist checked server-side on every privileged action — not
  something a regular signed-in user can reach by guessing a URL.
- All data in transit uses HTTPS/TLS (enforced by Vercel and Supabase by
  default). All data at rest is encrypted by Supabase and Vercel's own
  infrastructure.
- Security issues, once found, are fixed — not deferred, downplayed, or
  left "for later" because they seem low-traffic. (This is an existing,
  standing instruction, not new for this policy.)

**Policy owner:** **[EK: your name/role — e.g. "Ehren Kret, Founder"]**
**Review cadence:** Revisit this document at least every 12 months, or
immediately after any security incident.

---

## 2. Access Control Policy

**Who gets an admin account.** Administrative access to VLTD's backend
(the ability to see all users, grant subscription tiers, moderate
content, enable beta features, etc.) is granted only to:
- The founder's own account, identified by a fixed email address checked
  in every privileged server function.
- Any email explicitly added to the `user_roles` table in Supabase.

**[EK: is anyone besides you an admin today? If yes, list who and why.
If no, write "Founder only, as of this policy's date."]**

**Granting access.** New admin access is granted by inserting a row into
`user_roles` directly in the Supabase dashboard — there's no self-serve
signup for admin access, and there shouldn't be.

**Revoking access.** Remove the row from `user_roles` immediately when
someone no longer needs admin access (e.g., a contractor's engagement
ends). **[EK: is there anyone with access today whose access should be
reviewed or removed?]**

**Review cadence.** Review the full list of admin accounts (query
`user_roles`, plus confirm the founder-email check is still correct)
**every 6 months**, and log the date it was last reviewed here:
- Last reviewed: **[EK: date]**

**Regular user access.** Every signed-in user can only see and modify
their own data (or data explicitly shared with them — a team-shared
profile, or an Exhibition someone invited them to). This is enforced by
the database's own Row Level Security, not just app-level checks, so it
holds even if a bug elsewhere in the app tried to bypass it.

**Authentication.** Users sign in via Supabase Auth (email/password, plus
whatever social login providers are enabled). **[EK: is MFA/2FA available
today, and is it required or optional for admin accounts specifically? If
not yet enforced, note that as a known gap here rather than skip it.]**

**Service credentials.** API keys and secrets (Supabase service role key,
Stripe secret key, Anthropic API key, etc.) are stored as environment
variables in Vercel, never committed to the git repository, and never
exposed to the browser except where explicitly required (e.g., the
public anon key, which is safe to expose because RLS enforces the real
access control).

---

## 3. Incident Response Plan

**What counts as an incident:** unauthorized access to user data, a data
leak (even a small one — e.g., a bug that exposed one user's data to
another), a compromised admin account or API key, a successful attack on
the site, or a vendor (Supabase, Vercel, Stripe, Anthropic) reporting a
breach that could affect VLTD.

**Immediate steps, in order, the moment something is suspected:**

1. **Contain it.** Depending on what's happening:
   - Suspected leaked/compromised API key or service credential →
     rotate it immediately in Vercel's environment variables and in the
     provider's own dashboard (Supabase, Stripe, Anthropic).
   - Suspected compromised admin account → remove that email from
     `user_roles` immediately, then investigate.
   - A specific RLS/access-control bug being actively exploited → the
     fastest containment is usually a targeted RLS policy fix, deployed
     the same way any other fix ships (see the Deploy/infra rules in
     `HANDOFF.md`) — Supabase migrations can be run within minutes of
     being written.
2. **Assess scope.** What data was actually exposed, to whom, for how
   long? Check Supabase's own logs (Auth logs, Postgres logs if enabled)
   and Vercel's request logs for the affected window.
3. **Fix the root cause**, not just the symptom — same standard this
   project already holds itself to for every other bug.
4. **Notify affected users** if their personal data was actually exposed
   — what happened, what data, what you did about it. **[EK: do you want
   a template for this, and do you have a way to email all affected users
   if needed? Worth confirming Supabase's admin API can list/email
   affected accounts before you need it in a hurry.]**
5. **Document what happened** — add a dated entry to this file's own
   "Incident Log" section below, even for small ones. A pattern of small
   incidents is itself useful information.
6. **Decide on legal/regulatory notification** if needed. **[EK: this is
   the one step that may need a lawyer depending on scale/jurisdiction —
   don't skip getting real advice here if a real incident happens.]**

**Who's involved:** **[EK: right now this is presumably just you. If/when
there's a team, list who owns incident response and how to reach them —
a phone number, not just an email, for anything urgent.]**

**Incident Log** (append a dated entry every time this plan is actually
used, even for a near-miss):
- *(none yet)*

---

## 4. Backup & Disaster Recovery Policy

**What's backed up today:** Supabase automatically backs up the Postgres
database (the mechanism and retention window depend on the Supabase
plan — **[EK: check your Supabase project's Settings → Backups page and
note the actual retention window here, e.g. "7 daily backups" or
"Point-in-Time Recovery enabled, X days"]**). Storage buckets (images,
documents, wallpapers) are stored redundantly by Supabase's underlying
infrastructure but are not separately snapshotted the way the database
is.

**What's NOT backed up separately:** the application code itself lives
in git (GitHub), which is its own durable backup — if Vercel disappeared
entirely, the app could be redeployed elsewhere from the git history.
Environment variables/secrets are NOT backed up anywhere outside Vercel's
own dashboard — **[EK: worth keeping a secure, offline copy of the
critical ones (Supabase service role key, Stripe secret key) somewhere
you control, in case Vercel access is ever lost.]**

**Recovery time objective (RTO) / recovery point objective (RPO):**
**[EK: these are business decisions, not technical ones — roughly, how
long could VLTD be down before it's a real problem, and how much data
could you afford to lose (an hour? a day?) in the worst case? Once
decided, write the actual numbers here — they determine whether the
current backup setup is actually good enough.]**

**Restore testing.** This is the biggest real gap right now: **the
backup mechanism has never actually been tested by restoring from it.**
"We have backups" and "we've confirmed the backups actually work" are
different claims, and only the first one is true today. Recommended
first real action: create a throwaway Supabase project, restore a real
backup into it, and confirm the data comes back intact and the app can
actually run against it. Do this once, then repeat on whatever cadence
feels right (**[EK: quarterly? every 6 months? pick one]**).

- Last restore test performed: **[EK: date, once done]**

---

## 5. Vendor Management Policy

Every third party with access to VLTD user data, and why each is
trusted. Review this list whenever a new integration is added or removed
(a normal part of shipping a new feature, not a separate step to
remember).

| Vendor | What they have access to | Why they're trusted |
|---|---|---|
| **Vercel** | Hosts the app; sees all traffic/requests | Industry-standard hosting, has its own SOC 2 report available on request |
| **Supabase** | The full database, auth, and file storage | Industry-standard Postgres-as-a-service, has its own SOC 2 report available on request |
| **Stripe** | Payment/billing data | PCI-DSS Level 1 certified — the actual industry standard for handling card data; VLTD never sees raw card numbers |
| **Anthropic** | Photos submitted for AI-assisted item scanning | Used only for the specific analyze-item feature; **[EK: confirm — do you know what Anthropic's own data-retention policy is for API inputs? Worth a quick check of their API terms.]** |
| **Sanity** | Content for the `/learn` articles section | No user/vault data involved, editorial content only |
| **PSA / Discogs / Ticketmaster / SerpApi / upcitemdb / Metron** | Lookup queries only (a barcode, a cert number, a search term) — not full user records | Read-only lookups, cached server-side with a daily budget guard (see `HANDOFF.md` §B10/B3) |
| **Club integrations (Discord/Slack/Telegram/Reddit webhooks)** | Only messages a club owner explicitly configures to post | Owner-supplied credentials, scoped to that one club's own posting |

**Adding a new vendor.** Before wiring in a new third-party service that
touches user data, ask: what data does it actually need (minimize this),
does it have its own security/compliance posture worth checking, and add
it to this table once it's live.

---

## 6. Risk Assessment

A living document — revisit and update this at least every **6–12
months**, or after any significant change to the app's architecture.

| Risk | Likelihood | Impact | Current mitigation | Residual gap |
|---|---|---|---|---|
| RLS policy gap exposing user data | Was actually happening (8 found + fixed 2026-08-23/24) | High | Full audit completed once; no recurring audit scheduled yet | **No process to catch the NEXT one before it ships** — every new table/policy should get the same scrutiny the audit gave existing ones, not a one-time pass |
| Admin credential compromise | Low (small, explicit allowlist) | High (full admin access) | Server-side email/role check on every privileged action | MFA not yet confirmed/enforced (see Access Control Policy) |
| Vendor outage (Supabase/Vercel down) | Low-Medium | High (app fully unusable) | None beyond the vendors' own uptime | No documented fallback/status-page communication plan |
| Data loss (backup failure) | Unknown — untested | High | Supabase automatic backups (mechanism, not verified) | **Never restore-tested** (see Backup Policy) |
| Payment data exposure | Very low | High | Stripe handles all card data directly, VLTD never touches it | None significant |
| Third-party AI vendor data handling | Low | Medium | Photos sent only for the specific scan feature | Anthropic's own retention terms not yet confirmed |
| Insider risk (the founder's own account/device compromised) | Low | Very High (full access) | None beyond normal account hygiene | **[EK: do you use a password manager + MFA on your own email/GitHub/Vercel/Supabase logins? This is the single highest-value personal security habit given how much rides on one account.]** |

**Overall read:** the biggest gap isn't any one item above — it's that
most of this table currently says "no recurring process" rather than
"none found." A one-time audit (however good) is a snapshot; SOC 2 Type
II specifically exists to prove these controls keep running, not just
that they existed once. Phase 2 (the admin audit log, MFA enforcement,
a real restore test) is what turns this table's right-hand column from
gaps into "mitigated, recurring."

---

*Drafted overnight per EK's request while they were asleep — nothing
in here has been shown to EK yet. Every **[EK: ...]** marker needs a
real answer before this is a finished, followable policy set, not just
a draft.*
