# Reliability investigation (2026-10-18): the two count drops, blank loading, responsiveness

Read-only for customer data. No record was restored, recreated, changed or deleted. Confirmed facts and missing evidence are kept apart. Times are UTC unless marked PDT.

## 1. The two item-count drops (3,479 → 3,478 → 3,477)

### Confirmed
- **The arithmetic is exact.** 3,477 = 880 demo items (22 demo profiles × 40, every one intact) + 1,482 in the collection `260312-0001` ("Kellogg") + 1,114 in the collection `260310-0001` ("EK") + 1 in the real account created on 2026-10-14.
- **Where they went.** `260312-0001` measured **1,484 cloud items on 2026-10-15** (CHECKLIST recount "1,507 local / 1,484 cloud"; the 1,484-item performance test copy in HANDOFF) and has **1,482 now**. `260310-0001` was 1,111 on 2026-10-06 plus 3 items created 2026-10-11 = 1,114, unchanged. The 3,478 baseline of 2026-10-14 minus 880 minus 1,114 is 1,484. So **both drops are in `260312-0001`**, unless two opposite changes cancelled elsewhere (nothing suggests that).
- **When** (from timestamped tool output in the session transcripts):
  - Drop 1: after the last reading of 3,479 at **2026-10-15 21:10 UTC** and before the reading of 3,478 at about **2026-10-16 05:06 UTC**.
  - Drop 2: after the reading of 3,478 at **2026-10-17 02:51 UTC** and before 3,477 at **2026-10-17 07:00 UTC**.
- **The app does not delete items by itself.** Cloud pulls only merge. `/api/vault/[id]` is an in-memory stub. The only code that deletes vault items is the confirmed single and bulk delete (`deleteVaultItemEverywhere`, `deleteVaultItemsEverywhere`).
- **My own tool calls.** Across all transcripts, the only call that deleted from `vault_items` inside drop window 1 was the other-account delete test (2026-10-16 04:44 UTC). It targeted four QA-owned items and asserted all four still existed. Nothing of mine touched a non-QA row in that window by an inline call; calls that ran saved script files cannot be inspected this way (see Missing).
- **Imports reconciled by item id** (manifests in `C:\Users\EK\Pictures\VLTD-*-Images`): Celebrity Authentics **32 of 32 present**; Whatnot **1,109 of 1,109 present**; eBay **130 of 138 present, 8 missing**. The 8 missing eBay ids map one-to-one onto 8 unused item numbers inside the same-second import block (2026-10-05 22:26:31 to :34 UTC), so they were created and later removed. Two are not collectibles (a pond fountain, a solar monitoring gateway); six are sports break or proof-pack listings:
  `1791239191253_c8d06e`, `1791239191294_8512f0`, `1791239191519_c8ad74`, `1791239191554_01d5b6`, `1791239191559_deefe3`, `1791239191686_d49872`, `1791239194569_e66d78`, `1791239194651_e1e294`.
  Nothing else references them (no exhibition, sale or appreciation).
- **Value snapshots** (`portfolio_value_history`, taken from the browser's copy): the `260312-0001` total cost fell by **$34.23** between the 2026-10-15 06:07 UTC and 2026-10-17 06:03 UTC snapshots. Consistent with a deletion in that period; it cannot name the item.

### Not evidence (and why)
- **Gaps in item numbers do not prove deletions.** The number is taken by a BEFORE INSERT trigger on every insert attempt that arrives without a code, including an upsert of an item that already exists. `260312-0001` has 926 unused numbers (487 at the very end), `260310-0001` has 108. That is why these gaps cannot date or count deletions.
- **Orphaned image folders** (136 of 178 folders under `items/` match no current item) are mostly old; those dated 2026-10-14 to 10-18 (37) coincide with QA days and carry the synthetic camera's file sizes. They are probably QA residue, **not deleted** (no exact manifest; see Proposal).

### Missing (cannot be established from what is readable)
- Which two items left `260312-0001` after 2026-10-15, who or what removed them, and whether it was an app action, a QA script that ran from a saved file, or manual SQL. There is **no deletion log, no database backup readable from here (Free plan), and no per-row delete time**. The eBay match shows that 8 imported items were removed at some point; it does not show that these two are among them.
- Supabase API/Postgres logs for the two windows (they would show `DELETE` on `vault_items` with time and caller): retention on the Free plan is short and they are only readable in the dashboard.

### Next specific step (needs one human action, read-only)
EK's browser keeps its own saved copy of the Vault. If it was last synced before the drops it still holds the two items. `docs/investigations/local-vault-copy-ids.js` is a read-only console snippet: it changes nothing and downloads a small file with only ids, item codes, creation times, status and titles. Given that file I compare it to the cloud by id and name the two records exactly. Also useful and free: the Account page's "Local N, Cloud M" line (a local count above the cloud count means device-only copies exist).

### Proposal (not applied; EK decides)
An append-only deletion log: a trigger on `vault_items` DELETE writing the item id, item code, collection, time and the deleting role (no content) into a table no one can edit. That turns the next drop into a one-line answer.

## 2. Blank loading

### Evidence reviewed
- Ten 3-load runs and 60 sequential loads on production (`docs/perf-evidence-2026-10-17/results/blankload-*.json`, `blank-vault-idle`): every load reached "loaded" (cold load: blank 15 ms, "checking account" 516 ms, skeleton 1.0 s, loaded 1.5 s).
- The one real blank (page body empty at 10 s) happened right after a deploy, in a suite that captured no diagnostics. Not reproduced since.

### What the code showed (established)
- The Vault page itself handles failure: bounded account check, "Could not load" with Try again, a signed-out message, a "still loading" notice, and an earlier fix so a failed profile or cloud lookup is never read as an empty account.
- Three places could still show nothing, silently: **(a)** before the page's JavaScript runs, the route content is an empty div (a Suspense fallback), so if that JavaScript fails to download or start the page stays blank with no message; **(b)** the route gate shows an empty "Checking your account" div while it waits; the account code bounds each lookup at 8 s, so a gate hang is limited to about 8 s (measured: a held profile request made the gate wait 8,009 ms), but it showed nothing at all during that time; **(c)** there was no `error.tsx`, `global-error.tsx` or `loading.tsx`, so a drawing error had no page of its own.

### What was built (live on `29f0acc`; `bafb266`, `29f0acc`)
- A per-tab **load record** (`src/lib/loadDiagnostics.ts`, `vltd_load_diag_v1`): step name, ok/failed, milliseconds, short code. Never titles, notes, prices, links, e-mail, profile or account ids, tokens; links reduce to their path; capped at 60 entries; this tab only; sent nowhere by itself (unit test: 14/14).
- A **page-code watchdog** (plain inline script, runs before the app's code): records which script or style files failed to download (path only) and uncaught error names; if the app has not started after 10 s it shows a plain message with a Reload link and a one-line detail ("Step: page code did not start … resource:failed (script /_next/static/chunks/…)").
- **Route gate:** records the account check, shows "Still checking your account" after 4 s, and after 10 s a "could not check your account" message with Try again and Sign in instead of an empty div; an exception is caught and shown the same way.
- **Vault stages recorded:** device copy (count only), account check, profile, cloud pull, and what was finally shown. An empty list shown while the cloud never answered is recorded as FAILED, so "failed load looked like an empty collection" is detectable.
- `src/app/error.tsx`: a drawing error shows a plain page and records the error name and Next's digest (never its message).
- A bug report now carries the last 25 steps as text (no SQL; into the message). A 15-second summary of long tasks is also recorded, so a real phone's responsiveness reaches us through a bug report.

### Verification
Failure injection in a real browser, on production: normal load (every stage recorded, all ok, no content in the record); page code blocked (message after 10 s naming the step and failed files; Reload recovers); profile lookup held (placeholder text at 4 s; Vault says "Could not load", never "Your vault is empty"; record names `vault:profile`); cloud download failed with no device copy ("Could not load", record shows cloud pull FAILED and screen kind could-not-load; Try again recovers). **15/15.** Core flows (journey parts 1 and 2) 28/28; part 3 had 2 stale assertions that predate this change (they still expect the old copy-cost-into-value rule).
**Not verified:** the gate's 10-second message and `error.tsx` (nothing in the network can reach them: the account code answers within 8 s and no page throws on demand).

### Unknown
The root cause of the single blank after a deploy. A failed script download after an update would now show the watchdog message with the failed file path; if the next blank instead shows a gate or Vault failure, the record names the stage.

## 3. Responsiveness (normal browser vs throttled)

1,500 synthetic items, production, headless Chrome 1400 × 1000, one browser per condition (`scripts/resp-normal-vs-slow.cjs`, `results/resp-normal-vs-slow-2026-10-18.json`).

| | first card | longest task (>50 ms) per visit | worst scroll frame | typed search → next frame |
|---|---|---|---|---|
| **Normal speed**, visits 1–5 | 3,324 ms (first visit, downloads and repairs); then 301–477 ms | 123 ms (first visit); none on visits 2–5 | 18–20 ms | 4–18 ms |
| **4× CPU slowdown**, visits 1–3 | 7,455 ms; 2,841 ms; 1,632 ms | 639, 413, 247 ms | 21–35 ms | 24–67 ms |

- Existing traces (4× slowdown, tracing on): the long tasks are style recalculation, layout and paint of about 1,000 elements (881 ms task: UpdateLayoutTree 467, Paint 227, Layout 215). The same passes took 190 ms in a quicker visit of the same run: the work is the same, the machine was busier. Earlier hypotheses (global `:has()` rules, never-matching search rules) were tested and not supported.
- **Conclusion:** at normal speed the Vault is responsive (repeat visits have no task over 50 ms; scrolling and typing are well under one frame budget). The slow numbers exist only under CPU slowdown, which is not a phone. **No targeted fix is supported by the evidence**, and none is proposed. What would change that: real-device numbers. They are now collected automatically (`perf:long-tasks` in the load record, attached to bug reports).
- Invalid earlier run: a first attempt in this pass (`normal1`) ran against a fixture the free-plan item limit had cut to 50 items; its numbers are void and not used.
