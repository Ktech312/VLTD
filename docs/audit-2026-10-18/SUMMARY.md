# VLTD application audit - 2026-10-18/19 (inventory and behaviour results; nothing was fixed)

Coverage and operations log: `COVERAGE.md` (what was actually exercised by status and depth, by area and by route; load, failed commands and their effect).

Browsable report: `report.html` (filter by result, area, depth, impact; evidence links open the screenshots). CSVs: `results.csv` (every row), `inventory-pages.csv`, `inventory-controls.csv`, `api-inventory.csv`, `routes-static.csv`.

## Totals

| Measure | Count |
|---|---|
| Routes in the repository (pages / API) | 108 / 37 |
| Page visits recorded (state x width) | 471 |
| Controls inventoried | 18082 |
| Result rows | 9776 |
| FAIL | 562 |
| PASS | 5074 |
| NOT TESTED | 3886 |
| SUPERSEDED | 226 |
| BLOCKED | 28 |

Behaviour-asserted rows (a test checked the outcome): 3754 = 509 FAIL, 2770 PASS, 221 NOT TESTED, 226 SUPERSEDED, 28 BLOCKED. The rest are **smoke** rows (a control responded to a click; the outcome was NOT judged) and link rows (the link resolves).

**How to read FAIL:** 316 behaviour FAIL rows belong to the 34 root causes below (confirmed by the auditors after setting their own test mistakes aside). 188 further behaviour FAIL rows are first-run failures the auditors describe as mostly their own test mistakes; they are kept as first-failure evidence, marked "UNRECONCILED" in the Triage column, and need triage rather than repair. 5 FAIL rows (KNO-001..005) are the ORIGINAL Discover failures, kept as historical first-failure evidence, fixed before the audit and re-verified separately: they are not current defects. 226 rows are SUPERSEDED (first-run result replaced by a corrected row; both stay visible).

## Repair status (updated 2026-10-20)

**Batch 18 (2026-10-21, `repair-batch-18/CLOSEOUT.md`): banner and events pass, live and verified in a browser run (RB61): the seasonal theme now really recolors the app (it did nothing before), one fixed-size banner with event artwork, 15 s rotation, drag/swipe, one small clickable Seasonal theme line; event refreshes fixed and tested (26 of 26), failures now loud; LA Comic Con added (official dates confirmed). Open: real-phone check, LA Comic Con not in the banner until featured or the Oct 26 weekly run.**

**Batch 17 (2026-10-21, `repair-batch-17/CLOSEOUT.md`): all five SQL files run and verified on production (RB26 18 of 18, RB35 9 of 9, RB54 9 of 9, RB55 12 of 12, RB56 11 of 11, RB57 7 of 7, RB58 pass); RC-10, RC-11, RC-16, RC-19, RC-23 and RC-27 closed. Every root cause is closed.**

**Batch 16 (2026-10-21, `repair-batch-16/CLOSEOUT.md`): insurance exclusions follow the account (code live, SQL file 6 waiting for you) and Cancel in the crop step discards a just-chosen photo (ADD-168 closed).**

**Batch 15 (2026-10-21, `repair-batch-15/CLOSEOUT.md`): RC-05 closed (stage 4 ran and passed); RC-12, RC-20, RC-24, RC-25, RC-26, RC-29, RC-31, RC-32, RC-34 closed by your decisions and the phone pass; GIN-092, GIN-155, VLT-353 closed; the held SQL corrected (a live hole in the scan-allowance functions closed by file 1). Open: the SQL you run, GIN-095 (proposal), ADD-168 (decision).**

**Batch 14 (2026-10-21, `repair-batch-14/CLOSEOUT.md`): RC-30 closed (4 of 4); RC-29 10 of 12, RC-32 8 of 9, RC-34 7 of 8 rows closed. Open: Activity Dismiss behaviour, the dead CGC link, the Avatar emoji tab (all decisions).**

**Batch 13 (2026-10-21, `repair-batch-13/CLOSEOUT.md`): RC-24 15 of 16 and RC-26 19 of 24 rows closed. Open: VLT-385 (goal types), DIS-166, ACC-375/441/721 (Universes displayed), VLT-073 (all decisions).**

**Batch 12 (2026-10-21, `repair-batch-12/CLOSEOUT.md`): RC-25 6 of 7 rows and RC-27 8 of 12 rows closed; the view counter needs SQL file 3, VLT-147 is a decision.**

**Batch 11 (2026-10-21, `repair-batch-11/CLOSEOUT.md`): RC-23 13 of 15 rows closed; the other 2 (Market asking price) need SQL file 2.**

**Batch 10 (2026-10-21, `repair-batch-10/CLOSEOUT.md`): RC-22 closed (9 of 9 rows).**

**Batch 9 (2026-10-21, `repair-batch-9/CLOSEOUT.md`): RC-21 closed (26 of 26 rows); RC-20 10 of 22 rows closed, the other 12 need a product decision (explicit goal types).**

**Batch 8 (2026-10-20, `repair-batch-8/CLOSEOUT.md`): RC-16 14 of 16 rows closed on production; ADD-415 waits for the SQL file, ADD-168 is a product decision.**

**Batch 7 (2026-10-20, `repair-batch-7/CLOSEOUT.md`): RC-13, RC-14, RC-15 closed and RC-12 partly closed (code), all re-tested on production; RC-10 and RC-11 need one SQL file, ready in `repair-batch-6/SQL-RUN-ME.md`.**

**Batch 6 (2026-10-20, `repair-batch-6/CLOSEOUT.md`): RC-04, RC-07 (remaining six rows), RC-08, RC-28 and RC-33 closed and re-tested on production (21 of 21 checks).**

Full table with commits and evidence: `DEFECT-STATUS.md`. Closed and re-tested on production: **RC-01, RC-02, RC-03, RC-06, RC-09, RC-17, RC-18**, **7 of 11 rows of RC-19** and **3 of 9 rows of RC-07** (66 specific rows in total; batch 3 in `repair-batch-3/CLOSEOUT.md`, batch 4 in `repair-batch-4/CLOSEOUT.md`), plus **5 of 8 rows of RC-05** (EXH-165, 123, 124, 126, 127: batch 5, `repair-batch-5/CLOSEOUT.md`; the other three are migration-blocked or reporting-only). Deferred migrations and unresolved incidents are listed separately in `DEFECT-STATUS.md` (sections 3 and 4); they are not counted as closed. Tags below: [CLOSED], [PARTLY CLOSED]; untagged means still open.

## Prioritized defect list (root causes, genuine failures only)

### P1 - privacy / data loss

- **[CLOSED] RC-01 Opening another profile's exhibition by its address (Business active, Personal exhibition) EMPTIES it**  
  Reproduced independently by the coordinator (CRW-012): 7 items, 7 links and 7 layout entries became 0 although the page only said 'Exhibition not found'. The control visit on the matching profile changed nothing.  
  Rows (2): EXH-433, CRW-012
- **[CLOSED] RC-02 Private notes and 'Recorded cost basis' flow into public/buyer-facing text**  
  Marketplace listing copy contains the cost-basis line and the private internal note; 'Generate listing copy' puts the private note in its draft and Accept saves it as the public description; the public /share page then shows it to a signed-out visitor.  
  Rows (6): ITM-230, ITM-624, ITM-262, ITM-263, ITM-264, ITM-645
- **[CLOSED] RC-03 Cancelling an auction leaves a previously private item public**  
  Starting an auction makes the item public; Cancel Auction does not undo it (is_public stays true).  
  Rows (2): ITM-253, ITM-634
- **[CLOSED] RC-05 A public exhibition with an alias still hands the real profile id to anyone reading its row; alias/shelf-style edits do not autosave; Announce is refused by the database**  
  Direct read of the public row exposes profile_id despite an alias; the owner's insert into exhibition_events is refused by row-level security while the button reads 'Announced' (an unapplied migration is possible).  
  Rows (8): EXH-281, EXH-165, EXH-179, EXH-161, EXH-123, EXH-124 (+2 more)
- **[CLOSED] RC-06 Silent data loss in Add / Import / Halls**  
  Import 'Undo last' says it undid items that stay in the account; 'Skip exact titles' imports duplicates in a clean browser; approving an AI draft is not saved until /vault is opened; Bulk takes 60 of 62 files without saying; /capture loses typed data on leaving; 'Save as Hall' creates nothing and opens 'Exhibition not found'.  
  Rows (10): ADD-357, ADD-365, ADD-267, ADD-272, ADD-371, ADD-432 (+4 more)
- **[CLOSED] RC-07 Writes that look saved but are lost (Goals, profile fields)**  
  A goal target above ~2.1 billion shows 'saved' and is lost on reload; Create/Delete goal while the connection fails shows success but the database disagrees; an empty display name and bad usernames are saved.  
  Rows (9): GIN-066, GIN-068, GIN-070, ACC-381, ACC-796, ACC-390 (+3 more)

### P2 - blocked workflow / exposure

- **[CLOSED] RC-08 Admin screens (/admin/themes, /studio) are shown to signed-out visitors and non-admins**  
  The theme manager with + New Theme / Edit / Delete is visible to everyone; /studio shows its setup screen. By reading the table policy, writes need an admin role, and no write was attempted. Exposure, not a confirmed data-loss path.  
  Rows (7): CRW-001, ACC-396, ACC-439, ACC-515, ACC-405, ACC-459 (+1 more)
- **[CLOSED] RC-09 Printable insurance packet is a blank white page; item-sheet and inventory prints are unreadable**  
  A print rule in the page ([style*="--topnav"]{display:none}) matches the <html> element (it carries --topnav-shift), hiding the whole document, on screen and in print. Item-sheet print has near-white text on white; the top bar prints on four pages. NOTE: the coordinator's earlier production check of this page only confirmed the text existed, which could not detect this.  
  Rows (7): GIN-122, GIN-123, GIN-227, GIN-228, GIN-229, GIN-230 (+1 more)
- **[CLOSED] RC-10 Avatar upload is refused by storage for ordinary users**  
  Every avatar upload fails with a raw row-level-security message (verified with the QA login directly).  
  Rows (1): ACC-871
- **[CLOSED] RC-11 Bulk scan quota function refuses profiles whose id differs from the user id**  
  bulk_scan_status answers 'not authorized' unless profile id = user id; 17 of 39 real profiles (all 3 Business, 14 Personal) have different ids. Effect: no quota ticker; 'Scan with AI' says all scans are used without calling the AI.  
  Rows (7): ADD-428, ADD-429, ADD-430, ADD-431, DIS-366, DIS-367 (+1 more)
- **[CLOSED] RC-12 Lounge subject boards call the leaderboard function with the wrong argument name**  
  registryModel.ts sends {subject_name}; the current database function takes p_subject, so every subject board 404s and reads '0 collectors'. The function works when called correctly.  
  Rows (2): DIS-346, DIS-341
- **[CLOSED] RC-13 Header search ignores its query; Command Palette finds almost nothing**  
  The URL gets ?q= but the Vault ignores it ('zzzznomatch' still lists all items). Palette typed 'goals', 'discover', 'insurance', 'lounge' etc. finds nothing; only 'sold' and 'settings' work.  
  Rows (8): ACC-230, ACC-232, ACC-244, ACC-311, ACC-875, ACC-243 (+2 more)
- **[CLOSED] RC-14 Install banner covers controls on phones (browser-emulated)**  
  The Add to Home Screen banner covers the Quick Add shutter, the Bulk 'Add all' button, landing-page footer links and tag chips; a tap hits the banner.  
  Rows (6): ADD-235, ADD-379, ADD-380, ITM-424, ITM-425, ACC-832
- **[CLOSED] RC-15 Exhibitions page on a phone opens a details sheet over ~74% of the screen that cannot be closed**  
  Filter, sort, Tools and Create sit under it in the first view.  
  Rows (9): EXH-381, EXH-382, EXH-383, EXH-384, EXH-385, EXH-386 (+3 more)
- **[CLOSED] RC-16 Camera / image / PSA controls fail silently**  
  Refused Identify with AI, Quick Add camera start failure, wrong-type photos and empty import files give no clear message; 'Use Full Photo' and crop Cancel do the wrong thing; PSA 'Look up' does nothing visible; mouse drag-reorder of photos fails.  
  Rows (16): ADD-197, ADD-218, ADD-415, ADD-237, ADD-200, ADD-202 (+10 more)

### P3 - misleading result

- **[CLOSED] RC-04 SIMULATED interrupted connection: when the sign-out request fails, the page shows the login screen and gives no error while the session continues**  
  These rows were made with the sign-out request REFUSED by the audit, so they do not show that sign-out fails in normal use. A REAL sign-out of a synthetic QA session was verified separately and PASSED (CRW-025, CRW-026: session cleared, refresh token revoked, old session refused in a clean browser). Only the failed-request case is a finding: no error is shown and the session remains.  
  Rows (5): ACC-850, ACC-286, ACC-344, CRW-025, CRW-026
- **[CLOSED] RC-17 Values: letters, blanks and negatives become money; negative values accepted; numbers parsed wrongly**  
  'abc' saves $0 or blank under a green Saved; blanking an asking price saves $0; negative cost/price/value saved; '1e3' becomes 13 and '1,5' becomes 15; auction accepts a negative starting bid and a Buy It Now below the reserve.  
  Rows (20): ADD-005, ADD-115, ADD-404, ADD-139, ADD-141, ADD-142 (+14 more)
- **[CLOSED] RC-18 Sales ledger and profit figures break the value rule or disagree**  
  A sale with no cost reads as pure profit; a recorded $0 cost shows a dash; a sale made from For Sale shows its sold price missing and -100%; the item page and the Sold card show different profits for one sale; the Pricing card shows an explicit $0 value as '—'.  
  Rows (9): ITM-354, ITM-353, ITM-357, ITM-364, ITM-333, ITM-430 (+3 more)
- **[CLOSED] RC-19 Totals and counts disagree between Insurance, packet, reports, PDFs and Insights**  
  Insurance and packet list the 5 sold items, the reports do not; totals $1,431 vs $1,226 vs $1,443; Vault Insurance PDF says 44 items where 36 belong; exclusions are device-only; weekly gap count 31 vs 30; three pages report stale prices as three numbers.  
  Rows (11): GIN-087, GIN-092, GIN-240, GIN-243, GIN-260, GIN-095 (+5 more)
- **[CLOSED] RC-20 Goal progress and labels wrong; goal type guessed from words**  
  Direct URL shows every goal at 0%; Value/Sell/Exhibition goals count items, not dollars/duplicates/exhibitions; 'Insurable Value' counts items; type inferred from name text ('bedroom' becomes Exhibition); 'Completed This Year' has no year logic; 'View set'/'Review items' silently add a wishlist entry; Delete has no confirmation.  
  Rows (22): GIN-001, GIN-004, GIN-005, GIN-006, GIN-015, GIN-016 (+16 more)
- **[CLOSED] RC-21 A failed load is shown as an empty collection (or stays on 'Loading…')**  
  With the connection refused, Insights says 'No items yet', Activity/Alerts 'No activity yet', Goals 'No goals yet', reports an empty collection, Discover 'No public exhibitions yet', Upcoming/Watchlist/Home show empty or no stale notice; unknown club and the stream page for another user's item stay on 'Loading…' forever.  
  Rows (26): VLT-434, VLT-484, VLT-485, VLT-343, VLT-437, VLT-086 (+20 more)
- **[CLOSED] RC-22 Direct load in a clean browser shows zeros until the Vault has been opened**  
  /museum shows every card as 0 items / $0, /museum/new 0 current exhibitions, /vault/print 0 items, /vault/readiness 'No for-sale listings', /portfolio/insurance and /reports/weekly zeros, Settings export is a 64-byte empty file, sync line 'Out of sync - Local 0, Cloud 31'.  
  Rows (9): EXH-001, EXH-064, GIN-174, GIN-216, VLT-232, VLT-233 (+3 more)
- **[CLOSED] RC-23 Watchlist, Favorites and Market show invented or wrong numbers and broken links**  
  A wish's 'Current Value' is target x 1.18; watched items show a made-up Target Price and totals computed from them; Market cards link to /v/undefined (raw database error) and rank/total by current value not asking price; Favorites counts differ.  
  Rows (15): DIS-144, DIS-145, DIS-146, DIS-147, DIS-149, DIS-213 (+9 more)
- **[CLOSED] RC-24 Insights/Vault links and drill-downs lead to the wrong or an empty place**  
  Breakdown and cost rows link to an empty 'Misc' page; 'View all movers', '+ Add note', 'Open Exhibitions' go to plain /vault; unknown universe/slug silently shows Misc; empty gallery pages say 'Your vault is empty'; the universe drill-down defaults to a 30-day window.  
  Rows (16): VLT-364, VLT-366, VLT-368, VLT-377, VLT-378, VLT-385 (+10 more)
- **[CLOSED] RC-25 Sort and Halls arithmetic wrong**  
  Gain sort mishandles value-with-no-cost and explicit $0; default Wall view says 'Newest' but is A to Z; Halls ignore tax/shipping/fees and offer sold items; 'Recent' goal sort is not newest-first.  
  Rows (7): VLT-143, VLT-144, VLT-147, VLT-252, VLT-287, VLT-278 (+1 more)
- **[CLOSED] RC-26 Buttons that do something other than their label**  
  Exhibition list Duplicate/Export PDF/'View public page' only open the editor; Watchlist '+ Add Watch' goes to Add Item; 'Add to Insurance' only opens a print dialog; 'The Flip' links go to Discover; sign-out-all has no confirmation; 'Unlock All' clears the form; Universes-displayed setting is ignored by most pages; 'Switch app theme? Yes' changes nothing; '/auth/confirmed' says the email is confirmed with no code.  
  Rows (24): EXH-028, EXH-029, EXH-027, DIS-166, DIS-176, DIS-170 (+18 more)
- **[CLOSED] RC-27 Counters and messages that cannot be believed**  
  Exhibition view counter never increments for visitors; Upcoming date range edits the banner without refetching; signed-out Want says it could not save to your account; messages show 'Collector' for every partner and silently cut at 4,000 chars; expired invite says 'Link not available'; Bid History lists one bid twice.  
  Rows (12): EXH-283, EXH-284, EXH-285, EXH-292, DIS-252, DIS-271 (+6 more)
- **[CLOSED] RC-28 Create/profile forms give poor or wrong validation**  
  Double-clicking Create makes two exhibitions; a disabled Create has no explanation; 140-char title accepted though the editor caps at 80; taken usernames give only a generic 'Failed to save'; Verify Age shows 'Verified' before Save.  
  Rows (5): EXH-076, EXH-063, EXH-077, ACC-869, ACC-870

### P4 - usability

- **[CLOSED] RC-29 Close / Escape does not close panels, dialogs and sheets**  
  Discover and Watchlist detail panels, Lounge composer, photo preview, Edit Photo dialog, Activity details panel Close/Dismiss.  
  Rows (12): DIS-045, DIS-165, DIS-331, DIS-335, ITM-100, ITM-116 (+6 more)
- **[CLOSED] RC-30 Empty-result states missing when a filter matches nothing**  
  No-match search on Discover still lists all rooms; Watchlist and exhibitions filters show no message.  
  Rows (4): DIS-057, DIS-065, DIS-115, EXH-013
- **[CLOSED] RC-31 Small tap targets, off-screen feedback and sideways overflow on phones (browser-emulated)**  
  Targets under 44 px on item, Sales, Goals, builder and Events pages; 'Asking price saved' message off-screen; 2 px overflow on For Sale/Sold; Discover room card tap fills a panel 4,300 px down.  
  Rows (16): ITM-590, ITM-607, ITM-597, ITM-603, ITM-226, ITM-620 (+10 more)
- **[CLOSED] RC-32 Misc. navigation and wording defects**  
  Footer 'Exhibitions' link goes to login; onboarding header links bounce silently; dead CGC link; Lounge drops show an all-day event a day early (US Pacific); /lounge-preview shows developer wording; 'Open Exhibitions' wrong targets elsewhere.  
  Rows (9): ACC-029, ACC-098, ACC-105, ACC-184, ACC-479, DIS-345 (+3 more)
- **[CLOSED] RC-33 Legacy /api/vault/[id] accepts anonymous writes (reachable, not durable, not used)**  
  Probed with a synthetic payload only, after reading the code: POST/DELETE answer 200 to an anonymous caller; the route keeps items only in server process memory (no database or file), has no read endpoint, and nothing in the app calls it. Hygiene finding (unauthenticated memory use), not data exposure or loss.  
  Rows (1): CRW-027

### P5 - cosmetic

- **[CLOSED] RC-34 Cosmetic: emoji icons (standing project rule), raw labels and placeholders**  
  /shop and /saved use emoji; avatar emoji tab; 'key' shown as avatar in Switch Profile; category label 'Tv'; raw POP_CULTURE headings on print; placeholder subtitle; 'insured items' wording.  
  Rows (8): DIS-414, CRW-019, ACC-872, ACC-851, VLT-401, VLT-423 (+2 more)

## Routes reached only by direct address (no link to them in any crawled page, any state)

Recorded separately because navigation no longer exposes them; each was still opened by address in the crawl.

- `/account/invite`
- `/admin/bugs`
- `/admin/events`
- `/admin/events/quick-add`
- `/admin/museum-campus`
- `/admin/referrals`
- `/admin/scan-limits`
- `/admin/themes`
- `/admin/users`
- `/admin/waitlist`
- `/ai/review`
- `/auction/[id]`
- `/auth/confirmed`
- `/clubs/[clubId]`
- `/collector`
- `/favorites`
- `/ingest`
- `/kickstarter`
- `/learn/articles/[slug]`
- `/lounge-preview`
- `/museum/builder`
- `/museum/campus-prototype`
- `/museum/invite/[token]`
- `/museum/virtual-room/guest`
- `/museum/vltd`
- `/onboarding`
- `/owner-lab/forge`
- `/patreon`
- `/portfolio/insurance`
- `/portfolio/universe/[key]/category/[category]/subcategory/[sub]`
- `/redeem`
- `/registry`
- `/registry/[subject]`
- `/reports/weekly`
- `/reset-password`
- `/share/[itemId]`
- `/shop`
- `/studio/[[...tool]]`
- `/styles`
- `/vault/frames`
- `/vault/halls`
- `/vault/print`
- `/vault/sync`
- `/wishlist/[token]`

Redirect-only or legacy routes: /wishlist -> /watchlist; /user, /user/profile -> /account; /user/style -> /account?section=preferences; /more -> /dashboard; /gallery/[id] -> /museum/[id]/guest; /registry[/subject] -> /community-board[/subject]; /collector -> /dashboard (signed in). Obsolete/unreferenced API route: `/api/vault/[id]` (no caller; writes arbitrary items into server memory with no caller check).

## Not reached, BLOCKED, or only partly tested (and why)

- **BLOCKED by the safety rules:** typing a password, creating an account through Signup, a real sign-in via the form, receiving real email (so the post-login `?next=` redirect and password-reset completion), 2FA enrolment, Google sign-in completion, real Stripe checkout/portal/cancel, redeem codes (goes through the intercepted billing API), the bug-report Send (writes straight into the real admin inbox table), exhibition Report Submit (real moderation queue), posting/commenting/club create-join in the shared Lounge (visible to real customers), video clip section (beta accounts only; privileges may not be granted), Buy Now (purchase-style commitment).
- **Intercepted, not successful results:** every AI call (Identify, Scan, Analyze, Generate listing copy, COA), billing, auth email/password/sign-out requests, and the external lookups (card, PSA, UPC, comic, vinyl, events, Kickstarter, Patreon, Upcoming) were answered with a refusal or synthetic data by the audit library. Those rows test the app's handling of a refusal, not a successful result.
- **Not available to the QA role:** admin pages (`/admin/*`, `/owner-lab/forge`, `/studio` content), owner-only 3D pages `/museum/vltd`, `/museum/builder`, `/museum/campus-prototype` (only the access-denied behaviour), Team/Roles/Workspace as an admin; no privileges were granted to reach them.
- **Device limits:** all phone and touch checks were browser-emulated (CDP touch events); no physical phone or tablet, real camera/barcode, native share sheet, real printing or PDF file output. 3D canvas scenes (headless WebGL) were not asserted; only their DOM controls.
- **No data to test with:** no published CMS articles (`/learn/articles/[slug]` only shows the not-found state), no clubs (club pages opened with an unknown id only), no second profile's published events (follow alerts), a direct-message partner (QA profiles are private).
- **Phone coverage:** the full control probe ran at 1440 px (owner and visitor) and 390 px (owner); the Business profile and unrelated viewer were crawled at 1440 px only, onboarding user at 1440 px only.
- **Generic click-probe:** ~2,100 safe controls were clicked and responded; the 3,600+ NOT TESTED smoke rows are links (checked separately for existence), form fields, native selects, and destructive/paid/outbound controls the probe deliberately skipped (they were exercised in targeted suites on QA records where safe, otherwise stay NOT TESTED). 53 probe candidates with no visible effect are UNCONFIRMED (45 other candidates were re-checked with screenshot comparison and do respond).
- **Data integrity of this audit:** several auditors rewrote the shared rows file while others appended; 14 early DIS-* ids (DIS-001..008, 014, 016, 019, 021 and others) are absent from the final file (removed by that auditor's relabelling pass; replacement rows exist). A broad Chrome kill by one auditor around 22:55 on 10/18 may have ended other auditors' browsers; any oddly failing suite around that time was re-run by its auditor.
