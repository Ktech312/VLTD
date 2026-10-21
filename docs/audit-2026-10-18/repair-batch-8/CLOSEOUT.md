# Batch 8 closeout (camera, image and PSA controls that failed silently: RC-16), 2026-10-20

Commits `1c7dec1`, `9d52e16` (production). Scripts in `repair-batch-6/scripts/`: `rb28-silent-failures.cjs` (RB28), `rb29-intake-import.cjs` (RB29). AI requests were refused by the harness (nothing sent to the AI, no credit spent); no item was saved. First-run failures are kept (RB28-009 and RB28-012 are test mistakes with correction rows).

Cause of most rows: the Add page only showed a status line when it contained one of a short list of words ("failed", "error", "unavailable"...). "That scan file is not an image", "PSA lookups are paused", "PSA cert not found", "Image identify was not confident enough" and any AI error text without those words were set but never drawn. The same page-wide list now covers those messages. Quick Add cleared its own "used all scans" notice the moment the scan loop ended and swallowed every AI failure.

| Row(s) | What changed | Production check |
|---|---|---|
| ADD-465 | A non-image chosen on /vault/add says "That scan file is not an image." (it was set but hidden) | RB28-013 |
| ADD-197 | Identify failures read "Image identify failed (<reason>). Fill in the details by hand, or try again."; typed name kept | RB28-015 |
| ADD-190 | PSA Look up says the lookup is unavailable and the cert number is kept (no internal "testing barcode reading" wording) | RB28-016 |
| ADD-195, ADD-424 | "Use Full Photo" accepts the whole photo and closes the step (/vault/add and /capture native camera hand-off) | RB28-014, 020 |
| ADD-200, 202, 204 | /capture refuses .txt, .pdf and unreadable images when chosen, with a plain message and no tile | RB28-017..019 |
| ADD-417 | Thumbnail mouse drag-and-drop reorder works: the browser's own image drag was cancelling the pointer drag (the image is now not draggable). Before-fix evidence: ADD-417 | RB28-021 |
| ADD-237 | Quick Add says why the camera cannot start | RB28-022 |
| ADD-218 | Quick Add: "2 of 2 couldn't be identified. Fill them in by hand, or try again." (and the "used all scans" notice now stays) | RB28-023 |
| ADD-394, 395, 474 | Bulk intake notices and the empty-import message were already in place from earlier batches; now checked on production | RB29-001..003 |

## Still open in RC-16
- **ADD-415**: Bulk single-card Scan failure message. The card's button also needs a readable scan allowance, which needs the [batch 6 SQL](../repair-batch-6/SQL-RUN-ME.md). Until then the button is clickable and says the allowance could not be checked (RB28-024). To be re-checked after the SQL.
- **ADD-168**: Cancel in the crop step keeps the photo, because the page already says "Picture added. Crop if needed" when the file is chosen. Whether Cancel should discard a just-chosen photo is a product decision; not changed.
