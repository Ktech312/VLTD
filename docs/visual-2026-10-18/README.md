# Visual revisions, 2026-10-18: before / after screenshots

**Home screenshots: use `after-settled/`** (captured only after the photos in view, the exhibition covers and the Lounge block had actually loaded; `after-settled/settled-report.json` has the per-image result). The Home files in `after/` were taken on a timer and are superseded.

Taken on **production (https://vltd.app)** with a **synthetic account** (26 items with photos, 5 sales in three months including one loss and one with no recorded cost, 5 exhibitions). Full-page captures at 1440 px (desktop) and 390 px (phone). "Before" = commit `29f0acc` code (live before this work); "after" = deployed commit **`bc94649`** (code `7a17ef3`; the last commit that changed app code).
These are browser captures of the real site. They are **not** a physical phone: the phone files are a 390 px emulated viewport.

| EK's annotated screenshot | What was asked | Before | After |
|---|---|---|---|
| 1. Home: "View Vault" link beside the heading | Compact left text links on all four headings | `before/home-desktop.png` | `after/home-desktop.png` |
| 2. Home: red boxes | Recently added left, Your exhibitions right (stacked on a phone) | `before/home-desktop.png`, `before/home-phone.png` | `after-settled/home-desktop-dark.png`, `after-settled/home-phone-dark.png` |
| 3. Home lower sections (Lounge, Learn underlined) | Same link style | `before/home-desktop.png` | `after-settled/home-desktop-dark.png` |
| 4. Home collection overview (grey $, flat colour) | Insights palette, green/red/neutral, revenue vs profit, grey "at cost" kept | `before/home-desktop.png` | `after-settled/home-desktop-dark.png`; light: `before/home-desktop-light.png` / `after-settled/home-desktop-light.png`; phone: `after-settled/home-phone-dark.png`, `after-settled/home-phone-light.png` |
| 5. Insights page (reference palette) | (reference, unchanged) | `before/insights-desktop.png` | `after/insights-desktop.png` |
| 6. Insights: red line / black strip under the tabs | Remove the black rectangle | `before/insights-desktop.png` | `after/insights-desktop.png` |
| 7. Sold Items: header/tabs circled, two grey blocks circled | Real charts; one workspace header | `before/sold-desktop.png`, `before/sold-phone.png`, `before/sold-desktop-light.png` | `after/sold-desktop.png`, `after/sold-phone.png`, `after/sold-desktop-light.png` |
| Workspace tabs | One persistent Vault header + tab row | `before/items-desktop.png`, `before/forsale-desktop.png`, `before/goals-desktop.png` | `after/items-desktop.png`, `after/forsale-desktop.png`, `after/goals-desktop.png` |
| Sold chart cases | positive / negative / zero / one month / no recorded cost / no sales | n/a | `after/sold-case-<name>.png` |

Scripts that produced the captures and the checks are in `scripts/` (they need the synthetic-account helpers in `docs/ui-verification-2026-10-17/scripts/`).

## Settled-capture result (production, commit `bc94649`, synthetic account)
| Capture | Recently added photos in view | Exhibition covers | Lounge block |
|---|---|---|---|
| desktop dark | 4/4 loaded | 3/3 loaded | honest empty state ("No posts yet.") |
| desktop light | 4/4 loaded | 3/3 loaded | same |
| phone dark (390 px) | 3/3 loaded | 3/3 loaded | same |
| phone light (390 px) | 3/3 loaded | 3/3 loaded | same |

All four settled within about 3.3 s. The Lounge empty state is true: the database holds 0 Lounge posts (checked with the service key, as the QA account, and anonymously), so it is not a failed load shown as empty.

## How touch was tested
The phone swipe check (a left swipe moves the Recently added strip) used **browser-emulated touch** (Chrome DevTools touch events in an emulated 390 px viewport). It is **not** physical-device testing; real phones and push remain unverified.
