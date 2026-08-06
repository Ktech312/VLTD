# Grading cert lookup + pricing data — what's real, what isn't, what's being explored

Living reference doc (not a one-time handoff note — keep this updated as this
area changes, don't let it go stale like a HANDOFF section does). Answers one
question: **for a given grading company + item category, does VLTD verify a
real cert number against a real database, or is the field just free text?**

---

## Current state (as of 2026-08-06)

### Graded CARDS (sports cards, TCG singles in a slab)
| Grading company | Cert lookup? | Notes |
|---|---|---|
| **PSA** | ✅ Real | `src/lib/psaLookup.ts` + `/api/psa-lookup`. Pulls real grade/subject/set/population from PSA's own API. **Capped at PSA's own 100 calls/day, shared across every VLTD user** — not a per-user limit, a whole-app one. Guarded (permanent cache + internal 90/day budget, see `supabase/migrations/20260806_psa_api_guard.sql`) so testing/duplicate lookups can't burn it, but the guard doesn't add real capacity. **Does not scale to a real subscriber base as-is** — needs PSA's paid commercial tier, a business conversation with PSA, not a code fix. |
| CGC (cards) | ❌ Not built | Selectable in the Certification Company dropdown, but picking it does nothing beyond generic OCR/vision guesses — no real cert verification. |
| BGS / Beckett | ❌ Not built | Same as CGC cards above. |
| SGC | ❌ Not built | Same. |

### Graded COMICS
**PSA does not grade comics at all** (their business is cards, coins, tickets,
autographs — not comics). So "add CGC support" for comics isn't "the CGC
version of the PSA integration" — it's a **completely separate, currently
unaddressed feature**, regardless of what any cards-focused API covers.
| Grading company | Cert lookup? | Notes |
|---|---|---|
| CGC (comics) | ❌ Not built | Selectable in the comic grading dropdown; no cert verification exists. |
| CBCS | ❌ Not built | Same. |
| PGX / CGS | ❌ Not built | Same. |

What DOES exist for comics is a different thing entirely: `comicParser.ts` /
`comicBarcode.ts` read a comic's **retail UPC barcode** (Metron + GCD
databases) to identify *which issue this is* (title/issue number/publisher).
That works whether or not the comic happens to be graded, and has nothing to
do with verifying a grading cert number or pulling a real grade off a slab.

### Video games (WATA / VGA slabs)
❌ Not built. Selectable in the dropdown, no lookup.

### Market pricing (any category)
No real-time market-price API is wired in anywhere yet. `pricingMvp.ts`
handles curator-entered comparables, not a live pricing feed.

---

## Options researched 2026-08-06 (EK asked "what are our CGC alternatives")

| Option | What it covers | Verdict |
|---|---|---|
| **CGC's own official API** | Cert/image data, cards + comics (parent co. CCG) | ❌ Ruled out — authorized-dealer only (2+ yrs in the business, formal application, commercial references). Not a fit for VLTD's business model. |
| **CardHedge** (`ai.cardhedger.com`, `api.cardhedger.com/docs`) | Slab detection + `/prices-by-cert` across **PSA, CGC, BGS, SGC** — but their marketing emphasizes *cards*; **comics coverage is unconfirmed**, and EK's own read is it probably doesn't cover CGC-graded comics. | 🔶 **Being explored — EK reaching out directly.** Pricing/rate limits/signup terms are gated behind a contact form, couldn't be verified without EK submitting it. Best lead for **cards** (PSA+CGC+BGS+SGC in one API would be a real upgrade over the single-grader, 100/day-capped PSA integration); **not a comics solution** until/unless confirmed otherwise. |
| **GemRate Partner API** | Population/census across PSA, Beckett, SGC, CGC | 🔶 Contact-only ("Partner API"), reads as enterprise-priced. Also population/census data ≠ per-cert lookup — wrong data shape for "auto-fill this one item" even if pricing were viable. Lower priority than CardHedge. |
| **PriceCharting** (`pricecharting.com/api-documentation`) | General collectibles market pricing (games, some graded card/comic prices) | 🔶 Couldn't verify — their docs page blocked automated fetching (403). Looked self-serve/affordable from search results, worth a manual look if pricing (not cert verification) becomes the priority. Unconfirmed CGC-comics coverage. |
| **Apify CGC scrapers** (population report, comic census) | Scraped census/population data off CGC's own site | ❌ Ruled out — (a) wrong data shape, population counts not per-cert lookup or pricing; (b) real ToS/legal exposure building a paying product on scraped data without CGC's permission. |
| **CardGrade.io / Ximilar** | AI-predicted grade from photos of a **raw, ungraded** card | Not relevant to this question — different feature (pre-grading a raw card before submission), not a lookup for an *already-graded* slab. Worth remembering as a possible future feature, unrelated to cert verification. |

## Next steps
1. EK to contact CardHedge directly and get real pricing/terms/rate limits
   (their docs/signup are gated behind a contact form) — **specifically ask
   whether comics are covered at all**, not just cards, before assuming.
2. Once real terms are known, come back and decide: switch to CardHedge for
   cards (replacing/supplementing PSA), keep PSA as-is, or both.
3. **CGC-graded comics remain unaddressed** regardless of the CardHedge
   outcome — that needs its own separate research pass once cards are
   settled. Don't let "we fixed grading lookups" get reported as done until
   comics are explicitly covered or explicitly deferred.
