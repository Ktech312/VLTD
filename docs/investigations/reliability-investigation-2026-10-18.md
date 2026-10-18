# Reliability investigation (2026-10-18): the two count drops, blank loading, responsiveness

Read-only for customer data. No record was restored, recreated, changed or deleted. Confirmed facts and missing evidence are kept apart. Times are UTC unless marked PDT.

## 1. The two item-count drops (3,479 → 3,478 → 3,477)

### Confirmed
- **The arithmetic is exact.** 3,477 = 880 demo items (22 demo profiles × 40, every one intact) + 1,482 in the collection `260312-0001` ("Kellogg") + 1,114 in the collection `260310-0001` ("EK") + 1 in the real account created on 2026-10-14.
- **Where they went.** `260312-0001` measured **1,484 cloud items on 2026-10-15** (CHECKLIST recount "1,507 local / 1,484 cloud"; the 1,484-item performance test copy in HANDOFF) and has **1,482 now**. `260310-0001` was 1,111 on 2026-10-06 plus 3 items created 2026-10-11 = 1,114, unchanged. The 3,478 baseline of 2026-10-14 minus 880 minus 1,114 is 1,484. So **both drops are in `260312-0001`**, unless two opposite changes cancelled elsewhere (nothing suggests that).
- **When** (from timestamped tool output in the session transcripts):
  - Drop 1: after the last reading of 3,479 at **2026-10-15 21:10 UTC** and before the reading of 3,478 at about **2026-10-16 05:06 UTC**.
  - Drop 2: after the reading of 3,478 at **2026-10-17 02:51 UTC** and before 3,477 at **2026-10-17 07:00 UTC**.
- **No automatic delete was found in the code paths inspected. That is not proof that none exists.**
  - *Inspected:* every `.delete()` call in `src/` (`git grep`); `src/lib/vaultCloud.ts`, `vaultSyncQueue.ts` and `vaultModel.ts` (cloud pulls only merge, nothing is removed by a pull); the `/api/vault/[id]` route (an in-memory stub that never touches the database); `RouteGuard`; the tracked migrations (no trigger, scheduled job or cascade deletes `vault_items` rows; `vault_items.profile_id` is text with no foreign key to `profiles`). The only app code that deletes vault items is the confirmed single and bulk delete (`deleteVaultItemEverywhere`, `deleteVaultItemsEverywhere`).
  - *Not examined:* database objects that are not in the repository (hand-made triggers, functions, scheduled jobs, edge functions; the referral tables showed such objects exist), earlier app versions that were live during the two windows, Supabase dashboard or SQL-editor actions, scripts run from saved files, and anything on EK's own devices.
- **Who could delete through the app.** Row-level security allows an ordinary signed-in session to delete a vault item only if it is a profile manager (`vault_items_delete_manager`). The `260312-0001` collection has exactly one member, its owner. So an ordinary session could only have deleted as the owner's own account; anything else would have used the service key or the SQL editor. This narrows the set of possible actors. It does not identify one.
- **My own tool calls.** Across all transcripts, the only call that deleted from `vault_items` inside drop window 1 was the other-account delete test (2026-10-16 04:44 UTC). It targeted four QA-owned items and asserted all four still existed. Nothing of mine touched a non-QA row in that window by an inline call; calls that ran saved script files cannot be inspected this way (see Missing).
- **Imports reconciled by item id** (manifests in `C:\Users\EK\Pictures\VLTD-*-Images`): Celebrity Authentics **32 of 32 present**; Whatnot **1,109 of 1,109 present**; eBay **130 of 138 present, 8 missing**. The 8 missing eBay ids map one-to-one onto 8 unused item numbers inside the same-second import block (2026-10-05 22:26:31 to :34 UTC), so they were created and later removed. Two are not collectibles (a pond fountain, a solar monitoring gateway); six are sports break or proof-pack listings:
  `1791239191253_c8d06e`, `1791239191294_8512f0`, `1791239191519_c8ad74`, `1791239191554_01d5b6`, `1791239191559_deefe3`, `1791239191686_d49872`, `1791239194569_e66d78`, `1791239194651_e1e294`.
  Nothing else references them (no exhibition, sale or appreciation).
- **Value snapshots** (`portfolio_value_history`, taken from the browser's copy): the `260312-0001` total cost fell by **$34.23** between the 2026-10-15 06:07 UTC and 2026-10-17 06:03 UTC snapshots. Consistent with a deletion in that period; it cannot name the item.

### Leads, not proof of these two deletions (and why)
- **Gaps in item numbers are a lead, not proof.** The number is taken by a BEFORE INSERT trigger on every insert attempt that arrives without a code, including an upsert of an item that already exists. `260312-0001` has 926 unused numbers (487 at the very end), `260310-0001` has 108. That is why these gaps cannot date or count deletions.
- **Absent eBay imports and orphaned image folders are leads too.** The eight absent eBay items show that eight imported items were removed at some point, not that these two are among them. **Orphaned image folders** (136 of 178 folders under `items/` match no current item) are mostly old; those dated 2026-10-14 to 10-18 (37) coincide with QA days and carry the synthetic camera's file sizes. They are probably QA residue, **not deleted** (no exact manifest; see Proposal).

### Missing (cannot be established from what is readable)
- Which two items left `260312-0001` after 2026-10-15, who or what removed them, and whether it was an app action, a QA script that ran from a saved file, or manual SQL. There is **no deletion log, no database backup readable from here (Free plan), and no per-row delete time**. The eBay match shows that 8 imported items were removed at some point; it does not show that these two are among them.
- Supabase API/Postgres logs for the two windows (they would show `DELETE` on `vault_items` with time and caller): retention on the Free plan is short and they are only readable in the dashboard.

### Next specific step (needs one human action, read-only; nothing here touches or signs out any browser)
Plain instructions for EK, when convenient: open https://vltd.app in the browser you normally use, signed in as the Kellogg owner; open the developer console (F12, Console tab); paste the contents of `docs/investigations/local-vault-copy-ids.js` and press Enter; save the small `vltd-local-copy-ids-<date>.json` it downloads into the VLTD folder and tell me where. It only reads; it does not sign in or out, sync, or save anything.

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

---

## Update 2026-10-18 (second pass): the two records, the eight eBay items, and the blank-loading failure paths

Read-only for customer data again (service-key SELECTs only; nothing restored, changed or deleted). Scripts: `docs/investigations/scripts/`.

### A. The two later drops: identified by id (cause, actor and exact time still unknown)
**Method.** `vault_value_backup_20261008` is a table of item ids and values saved on **2026-10-08 16:37 UTC** (2,592 rows: 1,481 in `260312-0001`, 1,111 in `260310-0001`). Comparing it with the current `vault_items` by id gives exactly **two** ids that were in the backup and are gone now, both in `260312-0001`:

| id | title (source) | cost | what we know |
|---|---|---|---|
| `1778653394369_vb7r3n` | "Absolute Superman" (an earlier browser log in the session transcripts shows this id with the Kellogg profile) | $0 / value $0 | created 2026-05-13; its two photos still sit in storage (an app delete never removes photos, so that neither dates nor explains anything) |
| `1791239191686_d49872` | "Chicago Bears 2024 Topps Resurgence Football 4x Monster Box Break #625-12" (eBay import manifest, order 23-13200-25122) | $34.23 | the 1 of the 8 absent eBay imports that was still alive on 2026-10-08 |

**Why this is the pair.** The arithmetic closes exactly: the 3 current items missing from the backup are old (March/April; the backup simply did not cover them), so on 10-08 the collection held 1,481 + 3 = 1,484, which is the cloud count measured on 10-15; now 1,482 = 1,484 minus 2. The **$34.23** matches to the cent the fall in the collection's recorded total cost between the 10-15 06:07 UTC and 10-17 06:03 UTC value snapshots (113,691.87 to 113,657.64); "Absolute Superman" cost $0 so it cannot show in a cost total. Residual risk: an item both added and removed after 10-08 would leave no trace in any of these sources.
**Which window each fell in** cannot be separated: no snapshot exists for 10-16, and the cost figure cannot see a $0 item.

### B. The eight absent eBay imports are NOT the same event as the two drops
Of the 8 manifest ids missing today, **7 are absent from the 10-08 backup and 1 (`1791239191686_d49872`) is in it.** The backup covers imported items uniformly (every eBay item that exists today, 130 of 130, is in it; Whatnot 1,261 of 1,261; Celebrity Authentics 83 of 83), so the 7 almost certainly did not exist on 10-08. The import log says the collection held **1,491** items right after the eBay import (2026-10-05 22:27 UTC: "1,353 before, 1,491 now"); 1,491 minus 7 = **1,484**, the count on 10-08/10-15. So: **7 items removed between 2026-10-05 22:27 and 2026-10-08 16:37 UTC, then 2 more after 2026-10-15.** The 7 are an inference from coverage, not a record. The transcripts of that period contain no delete of those ids (that session had offered to remove the non-collectibles and was told to build a Supplies and Display group instead), so who removed them is unknown.

### C. Deletion logs and QA scripts reviewed
- **Deletion log:** none exists (no table, trigger or audit). Supabase API/Postgres logs for the windows are older than the Free plan's retention and are only readable in the dashboard.
- **My own tool calls:** all 20 session transcripts (2026-10-05 onward) were scanned for any call able to delete vault items (`.delete()` on `vault_items`, SQL `DELETE`/`TRUNCATE`, the delete helpers): 126 calls. **None names the Kellogg or EK collection, none names either of the two ids, and none is a bulk delete scoped to a real collection.** The delete calls inside the two windows are QA cleanup scripts, which delete by the manifest's own profile id (checked: a synthetic account, not Kellogg or EK) or by exact QA ids. A delete aimed at the wrong profile would have removed that collection wholesale, not two items.
- **Code paths:** an app delete also removes the id from every exhibition; neither id is referenced by any exhibition now (consistent with either never having been in one, or an app delete). `force_clear_vault` only clears the browser's own copy.
- **Not evidence:** numbering gaps (a trigger consumes a number on every insert attempt).

### D. What cannot be established, and what would resolve it
Unavailable: who or what deleted each item, the exact time of each, and whether it was the app, a script run from a file not in these transcripts, or the SQL editor. There is no log, no backup after 10-08 and no per-row delete time.
What would resolve it (each optional and read-only):
1. **The Kellogg owner's browser copy** (`docs/investigations/local-vault-copy-ids.js`, one read-only console snippet on vltd.app). Its specific value: it can now be checked for these two exact ids. If the copy still holds them, the removal did not come from that browser's app, and the copy also restores titles and fields for the record; if it lacks them, the removal may have been made from that browser (an app delete removes the local copy first). It cannot show who else acted.
2. **Supabase Logs for `vault_items` DELETE**, only if still retained (unlikely at this age).
3. **The deletion audit** (`docs/proposals/vault-items-deletion-audit-2026-10-18.md`, v2, NOT applied): from adoption onward, the next removal names the account or role, the origin (browser app, script or SQL editor), the network and the statement.
Separate small lead, not a deletion: the "Grails" exhibition references 3 item ids (`1778655365753_3k16cx`, `1774058559479_5e0xgy`, `1779168854923_xrxb2m`) that exist nowhere in `vault_items` or the 10-08 backup. They may be device-only items that never reached the cloud (the 10-15 recount found 23 device-only ids on the owner's device); unresolved.

## Blank loading: failure paths, verified by injected failures (isolated browsers, synthetic account, production)
Nothing was reloaded hoping the old failure returns; every failure below is made by the browser's own network interception.

| Path | Result |
|---|---|
| Page code fails to load (all files blocked) | **Verified** (15/15 suite): message after 10 s naming the failed files; Reload recovers |
| Deploy skew: page-code files answer 404 after the first 3 / 6 / 10 / 16 | **Verified**: in all four the watchdog message appears ("This page did not finish loading... Reload") with the failed file paths; never blank |
| In-app navigation while its page-data request answers 404 | **Verified**: the Vault still opens |
| Account/profile lookup held | **Verified**: gate answers at about 8 s (its own 10 s message is never reached); Vault says "Could not load", never empty; with a saved copy the items show at once |
| Session rejected (401 JWT expired) | **Verified**: sent to sign-in (`/login?next=/vault`), never an empty Vault |
| Cloud download fails or answers 500, saved copy present | **Verified**: items shown from the device, never empty (see defect 2 below) |
| Cloud download answers 500, no saved copy | **Verified**: "Could not load" + Try again, which recovers once the cloud answers |
| Cloud answers an empty list while the device holds items | **Verified**: the device items stay (a pull never removes anything) |
| Writes blocked, item added, reload with profile lookup held | **Verified**: change stays queued, no false empty Vault, reaches the database exactly once after unblocking |
| Stalled account check then "Try again" | **Defect found and fixed** (`58997b7`): the failed lookup was reused for a few seconds |
| A drawing error (`error.tsx`) | **Local dev build only.** Bad data in the saved copy could not provoke one on production (the repair layer absorbs it; 5 corruptions tried), so this stays unverified on production |

**Reproducible defects found in this pass**
1. **Home stayed on "Loading Home..." for ever when the cloud download hung** (60 s+ observed, nothing but the navigation visible), even with a complete saved copy on the device; the Vault under the same fault showed its 26 items at once. This is a reproducible blank-for-a-long-time path and a plausible contributor to what was seen; **it is not proven to be the historical cause**. Fixed in this pass: Home shows the saved copy at once when it verifiably belongs to the signed-in person and updates when the download finishes; with nothing saved and no answer within 20 s it says "We could not load your collection just now..." instead of waiting or showing an empty collection. (Verification on production: see the final report.)
2. **Silent staleness (open, not changed):** when the cloud is unreachable and a saved copy exists, the Vault shows the saved items but never tells the person. The message is set in code (`syncStatus`) but nothing renders it. The load record does show `vault:cloud-pull FAILED`.
3. **Retry volume (open, not changed):** with the cloud failing, one open Vault tab made 69 failed requests in 45 s (fallback page sizes 200 down to 2 with repeated retries). Failed requests transfer no data, but it is avoidable load during an outage.

**Historical cause: unknown.** What the tests support: recovery paths for failed code, account/profile lookup, cloud download and stale-deploy files are verified; failed requests are never shown as an empty collection on the Vault; pending changes survive and upload once. Not supported: that the one historical blank is explained by any of these. Home's unbounded wait was a real blank-looking path, but it was not recorded at the time.
