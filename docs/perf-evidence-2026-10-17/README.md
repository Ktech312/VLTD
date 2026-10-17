# Repeat-load stalls on a 1,500-item Vault: evidence package (closed 2026-10-17, issue stays OPEN)

Status: **investigation closed, rendering issue open.** No styles or layout were changed because of these experiments. Per-selector profiling is a separate, bounded investigation for later. Nothing here was run on a phone: "4x" below means the browser's CPU slowdown, which is only a rough stand-in.

## Test conditions (all runs)
- One isolated headless Chrome per run (fresh profile), signed in as a synthetic QA account, **1,500 synthetic items** (no photos), Gallery view, window 1400 x 1000.
- Visit 1 = first visit on that browser (downloads and repairs everything); visits 2 to 6 = repeat visits, each a plain navigation to `/vault`, waiting for the search box and the first cards, then 3 s.
- "Longest task" = longest browser long task (over 50 ms) during that visit (PerformanceObserver). The number in brackets is a machine check: a fixed 20-million-step JavaScript loop timed in the throttled page just before the visit (lower = faster machine at that moment).
- Tracing runs used the timeline, v8 and invalidation-tracking categories; profile runs used the V8 sampler at 1 ms. Tracing itself slows pages down: figures with tracing on are marked and are not mixed with tracing-off figures.
- Code: production `04d1669` (saved-copy speed-up) for the "production" rows; local production build of `12976b0` (adds the Add Item fix, identical for visits without an add) for the "local" rows. A/B rows use the SAME local build and fixture; the stylesheet was rewritten in transit by the test (no code change).

## Results at 4x CPU slowdown (longest task per visit, ms; machine check in brackets)
| run | where | visit 1 / 2 / 3 / ... |
|---|---|---|
| r1 | production 04d1669 | 638 / 480 / 188 / 602 / 179 |
| t1 (tracing on) | production 04d1669 | 485 / 879 / 754 / 189 / 350 |
| c1 | production 04d1669 | 539 (133) / 732 (106) / 647 (111) / 260 (103) / 199 (104) / 242 (80) |
| c2 | production 04d1669 | 497 (273) / 451 (231) / 198 (98) / 279 (232) / 189 (96) / 201 (93) |
| i1 (tracing on) | local 12976b0 | 590 (141) / 1082 (166) / 582 (161) / 582 (162) |
| ab-base 1-3 | local 12976b0 | 683 (131) / 589 (255) / 230 (171) / 273 (100); 630 (200) / 389 (240) / 232 (143) / 316 (132); 761 (231) / 527 (292) / 370 (154) / 333 (109) |
| ab-strip 1-3 (H1 removed) | local, same build | 827 (257) / 403 (262) / 293 (133) / 334 (109); 629 (162) / 414 (290) / 278 (139) / 240 (114); 708 (262) / 536 (289) / 298 (174) / 244 (120) |
| h2-base 1-3 | local 12976b0 | 748 (143) / 551 (154) / 386 (146) / 246 (177); 652 (253) / 419 (287) / 294 (125) / 243 (131); 685 (246) / 577 (269) / 248 (146) / 302 (103) |
| h2-vaultHas 1-3 (H2 removed) | local, same build | 714 (164) / 373 (297) / 277 (259) / 244 (123); 795 (221) / 488 (278) / 324 (151) / 283 (137); 712 (162) / 401 (321) / 401 (151) / 482 (131) |

Summary, 4x slowdown, tracing off: repeat visits on production range **179 to 732 ms**; the worst repeat visit with tracing on was **879 ms (production) and 1,082 ms (local)**. First visits 485 to 827 ms. These are the "190 to 880 ms" stalls: they exist only under the 4x slowdown.

## Results at normal speed (no slowdown), production, 1,500 items
- Run A (04d1669): first visit longest tasks 53 and 96 ms; second and third visits: no task over 50 ms.
- Run B (04d1669): first visit 175 and 53 ms; second visit one task of 208 ms; "Show more" in the Gallery 73 ms at most.
- Two runs only; not a phone.

## What the traces show (not a cause)
- The slowest repeat visits spend their long task in rendering: in the 881 ms task of t1/v2, UpdateLayoutTree 467 ms (285 + 183, on 960 and 457 elements), Paint 227 ms, Layout 215 ms; in t1/v3, 402 / 211 / 166 ms. A fast visit (t1/v4) did the same passes on the same element counts in 111 / 72 / 36 ms. Equal element counts therefore do not explain the difference, and no cause of the variation was found. Other slow tasks were a single React render call of 620 ms (t1/v2) and 223 ms (t1/v3).
- Invalidation tracking in these frames: about 48 gallery cards being added with their text, buttons and svg paths ("added to layout"); content-visibility cell recalculations (12 to 48 cells); image opacity transitions; and "affected by :has()" invalidations on BODY, MAIN and SECTION (6 to 14 per frame, with "invalidation set invalidates subtree" on BODY in the slowest frame).
- The saved-copy functions do not appear in the slow stretches.
- An 8 s idle profile after the first visit: 151 ms busy of 8,000 ms (no background work). The machine check was slowest before visit 2 in most runs (up to 321 ms against 80 to 170) but did not always predict a slow visit (c1 visit 2: fast machine check, 732 ms), so "machine speed" is a partial explanation at most.

## Hypotheses tested (one at a time, same build and fixture, 3 runs each, 3 repeat visits per run)
| hypothesis | test | repeat-visit longest task, median / worst | result |
|---|---|---|---|
| H1: the 67 global `:has()` rules in `insurance-pass.css` cause the expensive recalculation | rules removed in transit | 333 / 589 ms with them, 298 / 536 ms without | not supported; the number of `:has()` invalidation events did not change (213 to 234 vs 217 to 226) |
| H2: ~93 `main:has(input[placeholder="Search vault items..."])` rules in three stylesheets (the Vault search box's placeholder is "Search...", so they never match) | rules removed in transit | 302 / 577 ms with them, 373 / 488 ms without | not supported (no consistent change) |
Not tested: images (the fixture has none), skeleton replacement, content-visibility on the card cells (already in place), per-selector cost.

## Reproduce
Needs a QA account with 1,500 synthetic items (`scripts/visits.cjs` creates and removes them; it needs the project's service-role environment and is not runnable without it). Commands, from the scripts folder: `node visits.cjs <label> --base=<url> --visits=5 --cpu=4` (add `--trace=1` for traces, `--css=base|strip|vaultHas` for the A/B). `tracean.cjs` and `inval.cjs` summarise a trace (render task kinds; what was invalidated); `analyze.cjs` summarises a sampler profile. Traces kept here (gzipped): `traces/trace-t1-v2|v3|v4.json.gz` (production, tracing on), profiles `prof-r1-v4|v5.json.gz`. Open a trace in Chrome DevTools Performance (Load profile) after gunzip. Raw per-run results: `results/`.

## Blank-load diagnostics (kept available)
`scripts/cdp.cjs` records, for any test browser, the commit the page reports, session and profile readiness, requests to the account service with status and whether they were signed in, failed requests, console errors and navigations, and `captureDiag()` writes them to a file; `scripts/blankload.cjs` watches every load every 500 ms and classifies it (blank, checking account, skeleton, false empty, signed out, error, loaded) with a 60 s visible timeout. Last result: 60 loads in 20 isolated browsers, all loaded. The blank-load incident stays open; the next planned verification should include one idle cold load.
