# Correction set (Sold, Insights, Recently added, For Sale, centering): before / after

Production commit under test: **`718c24c`** (the last code change; later commits are evidence only). Synthetic QA account. Full-height captures taken only after every image on screen had loaded and the text stopped changing.
Phone widths are an emulated viewport (390 and 320 px) and phone touch is **browser-emulated touch**, not a physical device.

| Folder | What it is |
|---|---|
| `before/` | production before the changes (commit `47a8039`'s parent state): `sold-1669-dark`, `sold-390-dark`, `sold-320-dark`, `insights-1669-dark`, `forsale-1669-dark`, `forsale-390-dark`, `home-1669-dark`, `home-390-dark` |
| `local1/`, `local2/` | the local build while working (local only): Sold, Insights, For Sale at 1669/1440/1280/390/320, Home, light variants, Insights card close-ups |
| `after/` | production after: Sold (populated, 7 items, two categories), Insights, For Sale (3 items), Home at 1669/1440/1280/390/320 dark and 1440/390 light |
| `after-1item/` | production, one item: `forsale-1669/390/320-dark`, `sold-1669/390/320-dark` |
| `after-empty/` | production, empty: `forsale-1669/390-dark`, `sold-1669/390-dark` |

Annotated screenshots to files: (1) Sold row, summary chips and empty second row: `before/sold-1669-dark.png` / `after/sold-1669-dark.png`; (2) Sold cards and search: same files; (3) Insights summary cards: `before/insights-1669-dark.png` / `after/insights-1669-dark.png` (close-ups `local2/insights-cards-1669.png`, `-390.png`); (4) colours and the -$34 card: same Insights files, `after/home-1669-dark.png`; (5) Recently added: `before/home-1669-dark.png` / `after/home-1669-dark.png` (behaviour verified by input events, see the report); (6) For Sale: `before/forsale-1669-dark.png` / `after/forsale-1669-dark.png`, `after-1item/`, `after-empty/`; (7) centering: all `after/` captures plus the measurements in the report.

Scripts: `../scripts/` (`corr-shots.cjs`, `corr-verify.cjs`, `corr-test.cjs`, `centering.cjs`, fixtures). They need the synthetic-account helpers in `docs/ui-verification-2026-10-17/scripts/`.
