# Coverage and operations log (consolidated)

## What was actually exercised

| Depth | Rows | Distinct controls/workflows | PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED |
|---|---|---|---|---|---|---|---|
| Behaviour-asserted (a test checked the outcome) | 3754 | 3379 | 2770 | 509 | 28 | 221 | 226 |
| Smoke probe rows (a real click was attempted; PASS = the control responded, the outcome is NOT judged; NOT TESTED = could not be clicked, disabled, or a form field) | 4369 | 4082 | 2168 | 53 | 0 | 2148 | 0 |
| Smoke: skipped on purpose (destructive / paid / outbound / form) | 1517 | 458 | 0 | 0 | 0 | 1517 | 0 |
| Link resolves (existence only) | 136 | 136 | 136 | 0 | 0 | 0 | 0 |
| **All** | 9776 | 8055 | 5074 | 562 | 28 | 3886 | 226 |

Behaviour-asserted rows that count (superseded first-run rows excluded): 3528 rows, 3233 distinct controls/workflows: 2770 | 509 | 28 | 221 | 0 (PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED=0). Of the behaviour FAIL rows, only those listed under a root cause in SUMMARY.md are confirmed defects.

Row results that depended on a request the audit intercepted (AI, billing, email, sign-out, external lookups) are tagged INTERCEPTED/SIMULATED/POSSIBLY INTERCEPTED in their Actual text: 245 rows. They test how the app handles a refusal, never an end-to-end result. **Intercepted sign-out does not verify session termination**; the real sign-out of a synthetic QA session was verified separately (CRW-025, CRW-026).

Original Discover failures (5 rows, KNO-001..005) are kept as HISTORICAL failures, separate from the later re-verification PASS rows (KNO-006..014) and from the independent Discover auditor's rows (DIS-*).

## By area

| Area | What it covers | Rows | Distinct controls | PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED |
|---|---|---|---|---|---|---|---|---|
| VLT | Home, Vault list, Insights, Activity | 509 | 473 | 397 | 90 | 0 | 2 | 20 |
| ADD | Quick Add, Add Item, uploads, batch, imports | 476 | 415 | 307 | 87 | 2 | 24 | 56 |
| ITM | Item details, selling, For Sale, Sold, share, auctions | 737 | 673 | 513 | 51 | 4 | 92 | 77 |
| EXH | Exhibitions, builder, visibility, visitor views, 3D (DOM only) | 435 | 396 | 349 | 38 | 1 | 29 | 18 |
| DIS | Discover, Saved, Watchlist, Market, Upcoming, Events, Lounge, Learn | 416 | 407 | 341 | 54 | 3 | 18 | 0 |
| ACC | Landing, auth pages, onboarding, nav, Settings, account/admin access | 879 | 743 | 686 | 110 | 18 | 16 | 49 |
| GIN | Goals, Insurance, packet, reports | 261 | 234 | 158 | 65 | 0 | 32 | 6 |
| KNO | Known Discover failures (historical + re-verification) | 15 | 15 | 9 | 5 | 0 | 1 | 0 |
| CRW | Coordinator follow-ups (access, links, sign-out, legacy API) | 26 | 23 | 10 | 9 | 0 | 7 | 0 |
| SMK | Generic control probe (smoke) | 5886 | 4540 | 2168 | 53 | 0 | 3665 | 0 |
| LNK | Link existence | 136 | 136 | 136 | 0 | 0 | 0 | 0 |

## Coverage by route (108 pages; matched by the route text in each row, so approximate: a route referred to as "<exhibition id>" rather than its pattern can be undercounted; full list in coverage-by-route.csv)

- behaviour-tested: 99
- thin behaviour coverage: 7
- smoke only: 1
- inventoried only: 1

Routes with no behaviour row (smoke only or inventoried only):

- `/collector` (smoke only)
- `/studio/[[...tool]]` (inventoried only)

## Operations log: background tasks, load and failures

**Throttling check.** Across all 513 recorded crawl visits the pages' own failed requests were: 400 x26, 403 x1, 404 x4, 406 x6, 503 x269 (503s are the audit's own interceptions of /api/admin, /api/ai and similar). **No HTTP 429 and no 5xx from the app or the database were recorded.** The only failures from load were 34 crawl visits that ended in a browser-control timeout ("CDP timeout: Page.navigate"), all in the owner crawls while seven auditors plus four crawls were driving about eleven headless browsers from one machine, plus one abort of the visitor click-probe. Evidence that this was audit-generated load and not an app defect: the same pages loaded normally when retried once the load dropped (same account, same app), an idle-page check showed one background request in 20 s, and no server error was seen. The first-attempt records are kept in the crawl files (error field); the report shows "first attempt failed ..., retried OK". 190 visits did not reach the strict "settled" rule within 30 s (flag kept): under load that is expected and is not treated as a defect.

**Background tasks (each with one purpose; nothing is running now: no node or headless Chrome process, no live agents, scratch profiles deleted, `C:\qa-chrome` untouched).**

| Task | Purpose | Outcome / effect on coverage |
|---|---|---|
| crawl visitor 1440 and 390 | page inventory signed out | complete (108 pages each) |
| crawl owner 1440 and 390 | page inventory signed in (Personal) | first pass: 17 pages ended in CDP timeouts under load (kept as first failures); ONE retry run re-visited only those pages and all loaded; complete |
| crawl business / viewer / onboard 1440 | role and state spot-crawls | complete (14 / 17 / 8 pages); phone width not crawled for these states (gap) |
| crawl --only (4 runs) | re-visit two routes first recorded with a literal placeholder in the address | complete; the placeholder visits are ignored in the report |
| probe visitor 1440 | click every safe control, signed out | first run aborted by a CDP timeout; resumed once with a timeout-tolerant version (skips finished pages); complete; mostly the login page repeated |
| probe owner 1440 and 390 | click every safe control, signed in | complete; 1,110 and 1,413 controls clicked |
| verify-noeffect | re-check the probe's no-effect candidates with screenshot comparison | complete: 45 of 46 confirmed to respond; 1 not found on reload |
| links, extlinks, api inventory/probe | link existence and API access | complete; admin APIs answer 403 to anonymous callers |
| seven auditors (VLT, ADD, ITM, EXH, DIS, ACC, GIN) | behaviour suites per area on private fixtures | all returned; each fixture dropped and recounted; their own first-run test mistakes are kept and marked |
| follow-ups (coordinator) | admin exposure, club/confirmation pages, exhibition-wipe confirmation, real sign-out, legacy API probe | complete |

**Failed or orphaned commands and their effect.** (1) Two watch commands (b1gyqt1l7, b6mnqmxqj) expired when the session restarted; they only watched, no coverage effect. (2) One monitor (bfwb73n28) reported "failed" because `grep -c` returned 0 matches (exit code 1), not because anything failed. (3) A repository-wide grep (bj8owyak2) timed out and was replaced by a targeted search; no effect. (4) The visitor probe abort and the 17 owner-crawl timeouts above, handled by the retries listed. (5) The Add-flows auditor ran a broad kill of headless Chrome around 22:55 on 10/18; other auditors' browsers may have died then and those suites were re-run by their auditors, but the exact set is not recorded. (6) The Discover auditor's early rows DIS-001..008 and a few more were removed by its own relabelling pass. No duplicate crawl of the same purpose ran in parallel, and no new crawl was started after the data collection finished.

## Remaining coverage gaps by auditor (from each auditor's returned summary; their result tables are the "By area" table above)

- **VLT (Home, Vault, Insights, Activity):** follow alerts and admin bug-feed alerts not reachable (need another profile's events / admin); the Flip view right-swipe at 390 px is inconclusive (emulation artefact vs app: needs a real phone); phone behaviour is emulated only.
- **ADD (Add flows, imports):** real camera/barcode reads and the camera success path on /capture and /vault/add (BLOCKED: headless synthetic camera); /vault/sync "Device-only records" (no clean seed); live AI results (AI intercepted: only the refusal path was tested); ADD-470/472/276/277 are judgement calls (importer headers, huge prices).
- **ITM (Item details, selling, For Sale, Sold):** video clip section (BLOCKED: beta accounts only), Insurance PDF print from the item (BLOCKED: hidden-iframe print not observable), Buy Now (BLOCKED: purchase-style), Remove BG (external model download), Camera (none in headless); Add to Insurance and Escape-key rows are expectation judgements.
- **EXH (Exhibitions, 3D):** report Submit (BLOCKED: real moderation queue); owner-only 3D pages /museum/vltd, /museum/builder, /museum/campus-prototype (no owner role: only access-denied tested); 3D canvas scene interaction (headless pixels not assertable); return-to-invite after login (password entry blocked); comments/appreciations (not present on the guest page); very large background upload; the exhibition_events refusal may be an unapplied migration (cause not confirmed).
- **DIS (Discover, Saved, Lounge, Learn):** Lounge posts/comments/replies/reactions and club create/join/posts (BLOCKED: visible to real customers); Redeem (BLOCKED: billing API); a real published article (none exist); successful newsletter signup (real address); Flip Vibe (shared counter). External lookups (Upcoming, Events, Kickstarter, Patreon) answered with synthetic data: labelled intercepted.
- **ACC (Landing, auth, onboarding, nav, Settings, admin):** typing a password, account creation, real sign-in via the form, real email, 2FA enrolment, Google sign-in completion, real checkout/portal (all BLOCKED); bug-report Send (BLOCKED: real admin inbox); what `?next=` does after a real sign-in (unproven; an outside address in it is untested); sending a direct message (QA profiles are private); Repair/Migrate Images; push on; trusted-devices list; phone navigation suite for the viewer and Business profile; interests saving at the end of onboarding. Real sign-out was verified by the coordinator (CRW-025/026) after the auditor's rows were found to rest on an intercepted request.
- **GIN (Goals, Insurance):** native <select> dropdown driven by mouse; no edit-goal control exists; real printing/PDF/email not exercised (print stubbed); phone tests emulated.
- **Coordinator (pages, links, API, access):** Business, viewer and onboarding states crawled at 1440 px only; the generic click-probe did not run for the Business/viewer/onboarding states; external links with 403 (6) unverified; admin APIs probed anonymously only (owner/viewer 403 confirmed by the ACC auditor).
