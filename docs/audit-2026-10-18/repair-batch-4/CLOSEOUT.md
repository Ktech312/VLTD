# Repair batch 4: RC-17 (money inputs) and RC-18 (sales agreement)

Date: 2026-10-20. Production: https://vltd.app. Synthetic fixture only; no real purchase; no paid AI (the Quick Add check used Chrome's synthetic camera, the AI button was never pressed, every `/api/ai` request is blocked by the harness and counted: **0 seen, `ai_usage_log` unchanged**).

**Result: all 29 audit rows of RC-17 (20) and RC-18 (9) pass on production, plus the Quick Add manual path (14 checks), on the final deployed commit `b38f5f7`.** Two real defects in my own first fix were found by the production recheck and fixed (section 3).

## 1. Deployed commits (all on `main`)
| Commit | What |
|---|---|
| `97c1e9b` | RC-17: one strict money rule (`src/lib/moneyInput.ts`) used by Add, Capture, Bulk, Quick Add, pricing card, asking price, auction prices, sale price; checked in the save itself, not only the box |
| `8eea0fc` | RC-18: one sale rule (revenue - all-in cost - estimated fees; unknown cost = profit unknown; explicit $0 cost known) for item details, Sold cards, Home, Sales History; Return to Vault clears the platform |
| `a07fabc` | follow-up: the Add page showed none of the new refusal messages (found by the recheck) |
| `b38f5f7` | follow-up: ledger rows turned a blank cost into 0 (found by the recheck). **Final deployed commit.** |

Tests: `npm run test:money` (89 checks, new); existing `test:costs`, `test:sell`, `test:details`, `test:import`, `test:store`, `test:vault-load`, `test:repair-batch3` still pass; tsc, eslint (0 errors) and `npm run build` clean.

## 2. Defect-by-defect production table
"Before" = the current build as it was before the fix (first recheck, `evidence/rb9-first-before-*.json/log`); original audit rows and screenshots are unchanged. "After" = final run on `b38f5f7` (rows in `rows.jsonl`; desktop 1440 unless marked phone 390).

| Audit row | Defect | Before (recheck) | After (row) | Second browser |
|---|---|---|---|---|
| ADD-115 | /vault/add negative Current Value saved | saved -40 | refused, "can't be negative", nothing saved (RB9-161) | not needed (nothing saved) |
| ADD-139 | '1e3' saved as 13 | 13 / 13 | refused: "use numbers only (no letters or exponents like 1e3)" (RB9-162) | nothing saved |
| ADD-141 | '1,5' saved as 15 | 15 / 15 | refused: "use a period for cents... (1,5 is not supported)" (RB9-163) | nothing saved |
| ADD-142 | '5-3' saved as blank | blank / blank, green Saved | refused, message shown (RB9-164) | nothing saved |
| ADD-164 | 'abc' saved as blank | blank / blank, green Saved | refused, message shown (RB9-165) | nothing saved |
| ADD-005 | /capture negative value saved | saved -40 | refused with message, nothing saved (RB9-169) | nothing saved |
| ADD-404 | Bulk review grid -5 saved | saved -5 | refused, nothing added (RB9-172) | nothing saved |
| ITM-070 | item price 'abc' became $0 | 75 -> 0 | stays $75, message shown (RB9-173) | n/a |
| ITM-558 | same, phone | 75 -> 0 | stays $75 (RB9-206) | n/a |
| ITM-044 | Pricing Value -40 saved | saved -40 | refused, nothing stored (RB9-178) | n/a |
| ITM-529 | same, phone | saved -40 | refused (RB9-211) | n/a |
| ITM-227 | item asking price -5 left in box | box kept -5 | refused with message; saved price unchanged $99 (RB9-181) | n/a |
| ITM-292 | For Sale asking price -5 saved | saved -5 | refused, unchanged $120 (RB9-189) | n/a |
| ITM-294 | blank asking price saved $0 | saved 0 | blank clears to none (RB9-191); explicit 0 stays 0 (RB9-183) | n/a |
| ITM-306 | Mark sold 'abc' sold at $0 | SOLD, $0 | refused, still For Sale (RB9-192) | n/a |
| ITM-308 | Mark sold -50 | SOLD, -$50 | refused, still For Sale (RB9-193) | n/a |
| ITM-248 | auction negative starting bid | ACTIVE at -5 | refused, no auction (RB9-184) | n/a |
| ITM-629 | same, phone | ACTIVE at -5 | refused (RB9-214) | n/a |
| ITM-249 | Buy It Now below reserve | ACTIVE, reserve 2 / BIN 1 | refused: "can't be lower than the reserve price" (RB9-185) | n/a |
| ITM-630 | same, phone | ACTIVE | refused (RB9-215) | n/a |
| ITM-354 | no-cost sale reads as pure profit | +$70, "Bought —" | "Profit unknown", never a gain (RB9-196, RB9-201) | RB9-204 |
| ITM-353 | Wins counted the no-cost sale | the no-cost card was a +$70 gain counted as a win (check recorded in RB9 before-log; the original wins=3 included it) | Wins/Losses equal the gain/loss cards; no-cost sale is neither (RB9-198) | RB9-204 |
| ITM-357 | recorded $0 cost shown as a dash | "Bought —" | "Cost $0" (RB9-197) | RB9-204 |
| ITM-364 | sale made from For Sale shows no price and -100% | stored price 85 was correct; Sales History showed "Sold —", -$30, Margin -100% | Sold $85, cost $30, estimated fees, +$45; totals equal the cards (RB9-194, RB9-199, RB9-200) | RB9-204 |
| ITM-333 | item page and Sold card disagree | item +$638 vs Sold card +$548 | same profit on item page, Sold card, Sales History (RB9-202); Home profit = Sold page profit (RB9-203) | Sold card RB9-205, Sales RB9-204 |
| ITM-430 | Return to Vault left sold_platform | eBay kept | platform cleared with the rest of the sale (RB9-188) | n/a |
| ITM-666 | same, phone | eBay kept | cleared (RB9-217) | n/a |
| ITM-043 | Pricing card showed explicit $0 as "—" | not re-read in the first run (see note 1); original audit row stands | tile shows $0 where MARKET shows $0 (RB9-180) | n/a |
| ITM-527 | same, phone | same | $0 (RB9-213) | n/a |

Preserved behaviour checked at the same time (all pass): blank stays unknown and explicit 0 stays 0 on Add (RB9-166, 167), Capture (RB9-171), item price (RB9-176), asking price (RB9-182, 183), sale price 0 (RB9-195), `$1,250.50` and `2,000` accepted (RB9-168); the purchase-cost fallback ("At purchase cost") is shown without writing current_value / estimated_value (RB9-177, RB9-210); valid auction prices start unchanged (RB9-187).

## 3. Quick Add manual review/save path (requested addition)
Chrome synthetic camera, 3 captures -> review -> Verify sheet, no AI button pressed (RB9-147 to RB9-160, all pass): letters, `1e3`, `1,5`, `-5` in Cost and letters, `-4`, `5-3` in Value each show a plain message and hold Save; then explicit 0 / 0 saves as 0 / 0, blank / blank saves as unknown, `$1,250.50` / `2,000` saves as 1250.5 / 2000; **0 AI requests seen and blocked, `ai_usage_log` unchanged**; the item is listed after reload and opens in a clean second browser (RB9-160). Quick Add has no "before" run on production: it was requested after the fix was live, so its original failure rests on the earlier code finding (explicit 0 was dropped, letters were stripped), not on a production reproduction.

## 4. What the recheck found in my own first fix (kept as rows, fixed)
- RB9-002 to RB9-005: the Add page refused '1e3', '1,5', '5-3', 'abc' (nothing saved) but **showed no message**: its status line only displays text with a few words. Fixed in `a07fabc` with a regression check (`test-money-input.cjs` verifies the Add page shows each refusal). Passing rows RB9-162 to RB9-165.
- RB9-066, RB9-068, RB9-074: a sale with no cost, loaded from the account's sales ledger, still showed Cost $0 and +$70, because `Number(null)` is 0 in the ledger loader. Fixed in `b38f5f7`. Passing rows RB9-196, RB9-198, RB9-204.
- Test mistakes, explained by correction rows RB9-218 to RB9-221: the Pricing-card tile check (the tile is behind the card's Details toggle: RB9-019, 050, 083, 121, 142) and one desktop run that stopped at the For Sale page (last row RB9-134; did not recur).

## 5. What was tested directly on production, and what is covered by the shared parser
Every typed amount goes through one function (`parseMoneyInput`, 89 unit checks). The table separates what was driven on production from what relies on that shared function.

| Entry point | Direct production test | Shared-parser coverage only |
|---|---|---|
| /vault/add | letters, `1e3`, `1,5`, `5-3`, `-40`, 0, blank, `$1,250.50` (RB9-161 to 168) | |
| /capture | `-40`, `1e3`, 0 (RB9-169 to 171) | letters (number box cannot hold them) |
| Bulk review grid | `-5` (RB9-172); `1e3` refused with no write, then corrected to 1000 and saved (RB10-011, RB10-012) | |
| Quick Add Verify sheet | letters, `1e3`, `1,5`, `-5`, `-4`, `5-3`, then 0 / blank / `$1,250.50` saved (RB9-147 to 160) | |
| Item page price and Pricing card | `abc`, `1e3`, `1,5`, 0, `-40`, explicit $0 value (RB9-173 to 180, phone RB9-206 to 213) | |
| Item page asking price, For Sale asking price | `-5`, `abc`, blank, 0 | |
| Auction setup | negative start, Buy It Now below reserve, `1e3`, valid prices (RB9-184 to 187, phone 214 to 216) | |
| For Sale "Mark sold" | `abc`, `-50`, 0, `$85`, no-cost sale (RB9-192 to 195) | |
| Vault card "Sell" button | `abc`, `-50`, `1e3`, `1,5`, blank, cancel (nothing written), then one valid sale $120 on eBay, checked after reload and in a clean second browser (RB10-013 to 022) | |

Covered by the shared parser only (not typed on production): letters in /capture (its number box cannot hold them), and any spelling not named in the table (for example `5-3` was typed in Add and Quick Add but not in the Pricing card).

Other limits:
1. ITM-043 / ITM-527: the first run could not read the tile, so there is no first-run reproduction for this batch; the original audit rows are the failure evidence. That does not weaken the after-check, which reads the tile after opening Details and finds $0 (RB9-180, RB9-213).
2. Quick Add has no before/after pair (checked after the fix only).
3. Nothing historical was changed: existing saved values, sales and ledger rows are untouched.
4. **Found while closing the Sell gap, NOT fixed (outside batch 4):** the value box on a Vault card (`src/app/vault/VaultListView.tsx`, local `parseMoneyInput`) still uses an old lenient parser (blank or letters become 0, `1e3` becomes 13, negatives accepted). Read from code only; row RB10-024. It is not one of the 29 audit rows.

## 6. QA cleanup (exact)
- Fixture `rb9` dropped by manifest ids: items 0, exhibitions 0, profiles left 0, auth users left 0.
- After 20 s: `vault_items` 3,477 / `profiles` 39 / exhibitions 47 / `sales` 3 (the real rows) = baseline. Leftovers 0: items titled `QA RB9`, items with `qa_vz_` ids, exhibitions titled `QA`, `qa_sale_` ledger rows, profiles named QA, QA auth users.
- Scratch service-key helper (`docs/audit-2026-10-18/qa/env.cjs`), the fixture manifest and the add-tmp pictures deleted; none was ever committed.
- `Temp\qa-c` scratch browser profiles: 25 folders deleted, 0 left. `C:\qa-chrome` untouched (66 entries). No audit browser or script running.
- Scripts and evidence kept: `repair-batch-4/scripts/` (`rb9-money-sales.cjs`, `rb9-quickadd.cjs`, `rb9-corrections.cjs`, `rb9-recount.cjs`, `probe-deploy.cjs`, `dbg-*.cjs`), `repair-batch-4/evidence/` (before and after logs and JSON).

## 7. Gap closure (second pass, 2026-10-20)
Only two checks were rerun; the 29-row suite was not repeated. Fixture `rb10`, no code change.
- **Sell button** (it is on the Gallery and Flip cards of the Vault list, not on the item detail page; the Wall view has none): `abc`, `-50`, `1e3`, `1,5` and blank each show a refusal and change nothing (database, this browser's sales list, the card); cancelling changes nothing; one valid synthetic sale ($120, eBay, item cost $40 + $4 tax) records price 120 and platform eBay. After reload the item page, the Sold card and Sales History all show price $120, cost $44, estimated fees $16 and profit +$60; a clean second browser shows the same (RB10-013 to RB10-022).
- **Bulk `1e3`**: refused with "Current value (photo 1): use numbers only...", no item written; corrected to 1000 and saved (first item 1000, second explicit 0) (RB10-011, RB10-012).
- A first Sell run (RB10-001 to RB10-010) was a test mistake (Wall view has no Sell button) and is explained by RB10-023.
- Exact local screenshot paths: `repair-batch-4/evidence/rb10-screenshots.txt` (folder `C:UsersEKVLTD.claudeworktreesquizzical-hamilton-a45b28docsaudit-2026-10-18shots`, files `rb10-two-1.jpg` to `rb10-two-10.jpg` and `rb10-one-11.jpg`, `rb10-one-12.jpg`; the folder is gitignored).
- Cleanup for this pass: fixture `rb10` dropped by manifest ids (items, exhibitions, profiles, auth users all 0), the two Bulk items removed with their photos (0 storage objects left), recount after 20 s 3,477 / 39 / 47 / `sales` 3, 0 leftovers (`QA RB10`, `qa_vz_`, `qa_sale_`, QA profiles, QA auth users), scratch service-key helper and manifest deleted, 5 `Tempqa-c` folders deleted, `C:qa-chrome` untouched (66), no audit process running.

## 8. Master status
RC-17 and RC-18 are CLOSED (every row of both groups verified above; no unresolved finding remains inside either). Not touched and still open: Insurance (GIN-092, GIN-095, GIN-155, VLT-353; not labelled fully closed), install-banner overlap (RC-14), small tap targets (RC-31), RC-05, RC-28 profile-validation rows. Tutorials remain paused.
