# Batch 12 closeout (sorts and Halls arithmetic: RC-25; counters and messages: RC-27), 2026-10-21

Commit `1e70578` and earlier in the batch. Scripts in `repair-batch-6/scripts/`: `rb37-sorts-messages-misc.cjs` (RB37), `rb38-bid-history.cjs` (RB38), SQL `repair-batch-6/sql/3-exhibition-view-counter.sql` (tested 13 of 13 in a local Postgres; **not applied**). First-run failures kept; test mistakes have correction rows (ITM-746, ITM-747).

## RC-25: six of seven rows closed
| Row(s) | What changed | Check |
|---|---|---|
| VLT-143, VLT-144 | Gain sorts use the one gain rule: only an item with a value and a recorded cost has a gain; the others sort after the measured ones in both directions (the Vault had its own formula that counted a value with no cost as all gain) | RB37-010, 011 |
| VLT-252, VLT-287 | Halls total uses the shared value rule: the priced value, else what was paid in all ($50 + $5 + $5 = $60, was $50) | RB37-012 |
| VLT-278 | Halls offers only items still owned (no sold items) | RB37-012 |
| GIN-013 | Goals "Recent" sort (batch 9) | RB31-033 |

**Open: VLT-147** (in the Wall view, which is the default view, the page's Sort says "Newest" but the wall is grouped A to Z by design). Making "Newest" a flat newest-first list would change the default look of the Vault, so it is a decision for you: either "Newest" becomes a flat list, or the Wall is relabelled as A to Z.

## RC-27: eight of twelve rows closed
| Row(s) | What changed | Check |
|---|---|---|
| DIS-252 | Changing Upcoming's date range fetches the list for that range (it only rewrote the sentence above it) | RB37-013 |
| DIS-271 | Want while signed out asks the visitor to sign in (it said it could not save to an account) | RB37-014 |
| EXH-322, EXH-334 | An expired invite link says "Link expired"; an unknown one says "Link not available" | RB37-015 |
| DIS-308 | Messages names the other collector from their public profile (it read a profile row only the owner can see and showed "Collector") | RB37-016 |
| DIS-314 | The message box stops at 4,000 characters and says so (it cut silently) | RB37-017 |
| ITM-482 | One bid is listed once (the realtime feed and the page both added it) | RB38-001 |
| DIS-404 | A failed Kickstarter search shows a plain error and clears the previous result line. Caveat: the earlier successful search on the QA run showed no result line to leave behind, so the "stale line" case itself was not reproduced; the failure message and cleared state were | RB37-018 |

**Open: EXH-283, EXH-284, EXH-285, EXH-292 (exhibition view counter).** A visitor cannot write the exhibition row, so the counter never moved. The site now asks a small server function to count one view per viewer key; that function is the third SQL file ([SQL-RUN-ME.md](../repair-batch-6/SQL-RUN-ME.md)). The counter is a friendly figure, not tamper-proof: anyone can call it with made-up viewer keys.
