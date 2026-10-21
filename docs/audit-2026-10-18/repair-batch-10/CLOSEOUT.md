# Batch 10 closeout (direct loads in a clean browser showed zeros: RC-22), 2026-10-21

Commit `294ca45` (production). Script `repair-batch-6/scripts/rb34-clean-browser.cjs` (RB34): each page is opened directly in a browser that holds nothing saved, as an isolated QA owner; the expected figures come from the database. RB34-001..003 ran before the deployment had finished going live (correction row ITM-745 in rows); the re-run is 8 of 8.

| Row(s) | Page | What changed | Check |
|---|---|---|---|
| EXH-001 | `/museum` | the cards' item counts and values come from the account's items (they are pulled with the exhibitions) | RB34-009: counts [5,7,8,6,6,5] |
| EXH-064 | `/museum/new` | "Current exhibitions" and the exhibition limit come from the account's exhibitions; Create waits ("Checking your exhibitions…") until they are known, so a stale count can no longer let a person exceed their limit | RB34-010: 5 |
| VLT-232 | `/vault/print` | waits for the account; "0 items" only once the account answered | RB34-011: 26 |
| VLT-233 | `/vault/readiness` | lists the 4 for-sale items | RB34-012 |
| GIN-216, GIN-174 | `/portfolio/insurance`, `/reports/weekly` | (batch 9) now load the account's items | RB34-013, 014 |
| ACC-848 | `/account` | a device that has not downloaded the vault says so in grey instead of "Out of sync — Local 0, Cloud 31" in red | RB34-015 |
| ACC-418, ACC-849 | Export Vault JSON / CSV (account page, Vault menu, export button) | asks the account first when this browser holds nothing; never downloads an empty file: an empty vault or an unreachable account is said in a message | RB34-016: 31 records, 30,817 bytes |
