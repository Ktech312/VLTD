# VLTD — SOC 2 Roadmap (sketch, 2026-08-24)

Written in plain language for EK, not an auditor. If a term needs a
compliance vocabulary word, it's explained inline.

---

## 1. What SOC 2 actually is (and isn't)

SOC 2 is not a certificate you buy — it's a **report an independent CPA
firm writes** after examining your actual security practices against a
standard checklist (called the "Trust Services Criteria"). You don't
"pass" or "fail" a fixed bar; the auditor writes down what's true and
whether it's adequate, and that report is what you show an enterprise
customer's security team when they ask "can we trust you with our data."

Two flavors:
- **Type I** — a snapshot: "as of this one date, are these controls
  designed correctly?" Faster and cheaper (usually a few weeks once
  you're ready), often used as a first step.
- **Type II** — the real one most enterprise buyers actually want: "over
  a 3–12 month window, did these controls *actually operate*, continuously?"
  This is the one that unlocks bigger deals — it proves you didn't just
  set something up for the audit, you run it that way day to day.

**Why this matters for VLTD specifically:** right now, nothing forces you
to have any of this. The moment a business customer (an insurance
partner, a card-grading company, a marketplace integration) wants to
integrate with VLTD or pilot it, their procurement/security team will
ask "do you have SOC 2?" before legal will even look at a contract. Not
having an answer either kills the deal or adds months of back-and-forth
questionnaires instead of one report. This is a **sales-enablement
project wearing a compliance costume**, not just defensive housekeeping.

---

## 2. The five criteria — and which ones actually apply to you

SOC 2 covers 5 "Trust Services Criteria." Only the first is mandatory;
you choose which of the rest to include based on what you actually do.

| Criterion | Mandatory? | Applies to VLTD? |
|---|---|---|
| **Security** | Always required | Yes — this is the whole audit's core |
| **Availability** | Optional | Yes, lightly — you should be able to say "the site stays up and we know when it doesn't" |
| **Confidentiality** | Optional | Yes — user vault contents, item values, personal info |
| **Processing Integrity** | Optional | Probably skip for now — this is about guaranteeing computations/transactions are complete & accurate (more relevant to e.g. a payments processor) |
| **Privacy** | Optional | Maybe later — this is about PII handling specifically (collection, use, retention, disposal); worth adding once you're actively selling into insurance/enterprise, since they'll ask |

**Recommendation:** start with Security + Availability + Confidentiality.
That's the realistic, defensible scope for a small team right now. Add
Privacy later if an insurance-industry deal specifically requires it.

---

## 3. Where you already stand (as of tonight)

Good news: the security audit + fixes done this session
(2026-08-23/24) — closing the RLS holes on `public_profiles`,
`place_bid`, `public_favorites`, `profiles` billing columns,
`exhibition_events`, and the `galleries`/`gallery_items`/
`gallery_invites` sharing system — is **exactly the kind of evidence a
SOC 2 auditor wants to see**: a documented process of finding and fixing
access-control gaps. Keep every one of those migration files and the
reasoning behind them; that paper trail becomes audit evidence later,
almost unmodified.

Other things you already have, mostly by virtue of your stack choices:
- **Encryption in transit and at rest** — Vercel and Supabase both do
  this by default for you. Free win, just need to document it.
- **Vendor-managed infrastructure** — you're not running your own
  servers, so a huge slice of the "physical security" and "infrastructure
  security" checklist is inherited from Vercel's and Supabase's own SOC 2
  reports (they both have one — you'll want copies on file to point to).
- **Version-controlled change history** — every code change goes through
  git, which is itself a control auditors like to see (who changed what,
  when).

What's genuinely missing (the real work ahead):
- No **written security policies** — nothing on paper says "here's how we
  handle access, incidents, backups, vendor risk." Auditors grade the
  policy *and* whether you follow it.
- No **enforced MFA** on admin/Supabase/Vercel accounts specifically as a
  documented requirement (you personally may already use it — needs to
  be a policy, not a habit).
- No **audit logging of admin actions** — e.g. who toggled a user's tier
  or museum-beta flag, and when. Right now that's invisible after the
  fact.
- No **incident response plan** — a written "if X breaks/leaks, here's
  the exact sequence of who does what" document. You don't need drama,
  just a checklist that exists before you need it.
- No **backup/restore testing** — Supabase backs up automatically, but
  "we've never actually tried restoring from one" is a real gap.
- No **vendor risk review** — a short list of every third party with
  access to user data (Supabase, Vercel, Stripe, Anthropic, Sanity, PSA
  API, etc.) and why each is trusted.
- No **access review process** — periodically checking "who still has
  admin access, and should they."
- No **risk assessment document** — a simple, honest "what could go
  wrong and how likely/bad is it" writeup, revisited periodically.

None of this is a rewrite of the app. It's mostly writing down what you
already mostly do, tightening a few gaps, and turning "I'd remember to
do that" into "there's a checklist and a log."

---

## 4. Phased plan

### Phase 0 — Foundation (mostly done tonight)
Close the access-control gaps an auditor would flag immediately.
✅ Largely complete as of 2026-08-24 (the RLS/RPC security audit).
Remaining: audit logging for admin actions (see Phase 2).

### Phase 1 — Paper (1–2 weeks of part-time writing, no engineering)
Write the policies. These can be short — a page or two each, not legal
novels:
- Information Security Policy (the umbrella document)
- Access Control Policy (who gets admin, how it's granted/revoked)
- Incident Response Plan
- Backup & Disaster Recovery Policy
- Vendor Management Policy (your Supabase/Vercel/Stripe/Anthropic list)
- Risk Assessment (a living document, revisited every 6–12 months)

I can draft all of these with you — they're mostly interviewing you
about how VLTD actually operates and writing it down accurately, plus
filling in a few decisions you haven't had to make yet (e.g. "how long
do we retain data after account deletion?").

### Phase 2 — Technical controls (engineering work, can overlap Phase 1)
- **Admin action audit log** — a table that records every privileged
  action (tier changes, museum-beta toggles, admin grants/revokes, coupon
  creation) with who/when/what. Small, contained addition — could reuse
  the `is_privileged` pattern from tonight's audit.
- **Enforce MFA** on the Supabase dashboard, Vercel, GitHub, and your
  email/password manager — this is an account-settings change, not code.
- **Verify backups work** — actually restore a Supabase backup to a
  scratch project once, document the steps and how long it took.
- **Basic uptime monitoring + alerting** — something that pings the live
  site and tells you (not your users) when it's down. Needed for the
  Availability criterion.
- **Dependency/vulnerability scanning** — e.g. GitHub's free Dependabot
  alerts turned on, so known-vulnerable packages get flagged automatically.

### Phase 3 — Pick your path
Two realistic ways to actually run the audit:
- **A compliance-automation platform** (Vanta, Drata, Secureframe,
  Thoroughly, etc.) — software that connects to your Vercel/Supabase/
  GitHub accounts, continuously checks controls, and hands you most of
  the paperwork. Costs roughly $10–30k/year depending on vendor and
  company size, but dramatically cuts the manual auditor-prep work and
  is the standard path for small teams now. **This is what I'd recommend**
  given it's just you — it turns most of Phase 1/2's ongoing upkeep into
  automated checks instead of a spreadsheet you maintain by hand.
- **Direct with an audit firm**, no automation platform — cheaper
  software cost, but meaningfully more of your own time spent gathering
  evidence by hand for the audit. Only makes sense if budget is the
  binding constraint.

### Phase 4 — Type I audit
Once Phases 1–3 are in place, a Type I audit is mostly a paperwork
review plus a short set of interviews. Typically a few weeks turnaround
once the auditor has everything. This is the artifact you can start
showing prospects while Type II is still running.

### Phase 5 — Observation window
Run the controls for real, continuously, for the window you're targeting
(3 months is the minimum most auditors will accept for Type II; 6–12
months is more typical and more convincing to enterprise buyers).

### Phase 6 — Type II audit
The auditor reviews evidence from the observation window (your audit
logs, access review records, incident log if anything happened, backup
test records, etc.) and issues the Type II report.

---

## 5. Realistic timeline & cost, ballpark

- Phase 0: done.
- Phase 1 (policies): 1–2 weeks, no hard cost beyond time.
- Phase 2 (technical controls): 1–3 weeks of engineering, no hard cost
  beyond time (maybe a small monitoring-service bill, e.g. $0–20/mo).
- Phase 3 (platform + auditor selection): a few days to decide, then
  the platform subscription starts (~$10–30k/yr).
- Phase 4 (Type I): 4–8 weeks after Phase 3 starts, auditor fee roughly
  $8–15k for a company this size.
- Phase 5 (observation window): 3–12 months, no new cost beyond keeping
  the lights on.
- Phase 6 (Type II): auditor fee roughly $12–25k.

**Total realistic cash cost for a first Type II, all-in:** roughly
$30–70k across the platform + both audits, spread over 6–15 months.
That's a real number — worth deciding if this is funded by a specific
prospective deal that needs it, versus done speculatively.

---

## 6. My recommendation for what to do next

Don't start the clock on Phase 3 (the expensive part) until there's a
concrete deal or investor asking for it. But Phases 1 and 2 are cheap,
mostly just time, and make VLTD genuinely more resilient regardless of
whether a formal audit ever happens — a written incident response plan
and an admin audit log are worth having even with zero enterprise
customers. I'd suggest:

1. I draft the Phase 1 policy documents with you (short interview,
   then I write drafts for you to correct).
2. I build the admin audit log (Phase 2's biggest single piece) as a
   normal engineering task, same as tonight's other fixes.
3. Hold Phase 3 onward until a real prospect or investor conversation
   makes the timeline concrete — at that point, tell me the deal's
   timeline and I'll help evaluate which automation platform fits.
