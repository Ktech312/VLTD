# Batch 14 closeout (panels that close, empty results, navigation wording, cosmetics: RC-29, RC-30, RC-32, RC-34), 2026-10-21

Commits `a71052a`, `5bedc24`, `fd1316e`, `d52e26b`. Scripts in `repair-batch-6/scripts/`: `rb42-close-empty-glyphs.cjs`, `rb43-lounge-onboarding.cjs`, `rb44-escape-close.cjs`, `rb45-close-empty-more.cjs`, `rb46-discover-empty.cjs`, `rb47-labels-switcher.cjs`; corrections in `corr-rb42.cjs` and `corr-rb43.cjs` (ITM-748 to ITM-751). First-run failures are kept: most ran before the deploy was live, one looked for the panel title in lower case when the page shows capitals, one counted inline SVG when the site's icons are image files. Each has a correction row and a passing re-run.

## RC-29: Close and Escape: 10 of 12 rows closed
| Row(s) | What changed | Check |
|---|---|---|
| DIS-045 | Discover: Close on the details panel closes it (the first room took its place) | RB42 |
| DIS-165 | Watchlist: Close details closes it | RB44 |
| ACC-736, VLT-463 | Activity: Close closes the details panel | RB45 |
| DIS-331 | Lounge composer closes on Escape ("Ask the Lounge") | RB44 |
| DIS-335 | Same dialog for "Post an Update" (one shared composer, one Escape handler). Not clicked separately | code, RB44 |
| ITM-100 | Item photo preview closes on Escape | RB44 |
| ITM-116 | Edit Photo dialog closes on Escape (asks first when there are unsaved changes, the same question Cancel asks) | RB45 |
| ITM-584, ITM-610 | The phone-size versions of the two rows above. They use the same components; not re-run at phone size | code, RB44, RB45 |

**Open: ACC-737, VLT-464 (Activity "Dismiss").** The red button now closes the panel exactly as Close does. The rows expected Dismiss to remove the entry from the list. Removing a history entry is a product rule I did not invent: decision for you (make Dismiss remove the entry, or relabel the button "Close").

## RC-30: empty results: 4 of 4 rows closed
| Row(s) | What changed | Check |
|---|---|---|
| DIS-057, DIS-115 | Discover: a search that matches nothing shows "No exhibitions match" alone: no featured rooms, no carousel, no room cards (it listed every room underneath) | RB42, RB46 |
| DIS-065 | Same list logic for a universe filter with no rooms. **Not run on production**: every universe tab that currently exists there has rooms. Covered by the same code path as the search case | RB46 (not tested) |
| EXH-013 | Exhibitions: a filter that matches none says "No exhibitions match this filter. You have 5 in total." with a Show all button | RB45 |

## RC-32: 8 of 9 rows closed
| Row(s) | What changed | Check |
|---|---|---|
| ACC-029, ACC-098, ACC-105 | The public footer no longer has an Exhibitions link to the login-only page; the one Exhibitions entry jumps to the public rooms on the page and Discover opens Discover | RB42 |
| ACC-184, ACC-479 | A person sent to setup from another page (Vault, Lounge) is told "Finish setting up your account first." Opening setup directly shows no note | RB43 |
| DIS-345 | Lounge drops read an all-day event on its own day (Oct 22) in a US Pacific browser and say "All day" instead of an invented clock time | RB43 |
| DIS-362, DIS-363 | Lounge preview uses customer wording (no table names, "fake", "not wired", "Future"); "Post Update", "Choose Feature" and "Manage spotlights" are shown only to an admin | RB43 |

**Open: CRW-020 (Shop link "CGC Comics Grading" ends on a 404).** The supplier's own site answers 404 on every address I tried (including its home page), so I cannot tell which address replaced it. I did not guess one or remove the link: decision for you (tell me the current CGC page or drop the entry).

## RC-34: 7 of 8 rows closed
| Row(s) | What changed | Check |
|---|---|---|
| DIS-414, CRW-019 | /shop product cards use the themed line-art glyph for their category (26 of 26); /saved has no emoji | RB42 |
| ACC-851 | The Switch Profile list shows each profile's picture (or its initial), not the raw avatar id | RB47 |
| VLT-401 | Insights category names read "Movies / TV / Film" (TV, DVD, CD, VHS, LP, 3D stay upper case) | RB47 |
| VLT-423 | The category page subtitle no longer says "Future DB-ready structure" | RB47 |
| VLT-235 | The collection report heads groups with the universe name ("Pop Culture"), not POP_CULTURE | RB47 |
| GIN-124 | The insurance packet header says "counted items" (fixed in an earlier batch) | code |

**Open: ACC-872 (Account > Avatar > Emoji tab).** The tab is a text box where the person types their own emoji as an avatar, with no way to choose the drawn presets that onboarding offers. Replacing it means adding a preset picker to Settings: a feature, not a wording fix. Decision for you.

## Not verified on production in this batch (stated so they are not mistaken for passes)
DIS-065 (no universe tab on production currently lacks rooms; same list logic as the verified search case), DIS-335 (the second composer button), and the phone-size rows ITM-584 and ITM-610 (same components as the desktop rows that were run).
