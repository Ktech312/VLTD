# "Universes displayed" removed as a filter on owned items (2026-10-21)

Commit `f06c29a` (and its evidence commit), live on production. Nothing was deleted or recategorised.

## What changed
- **Home, the Vault and Insights** now count and list every item you own. Nothing hides a universe there: no filter, no notice, no "all hidden" page.
- **The setting is gone**: Account > Preferences no longer has "Universes displayed" / "Show all universes", and the Vault's "Show" menu (which was the same setting) is gone.
- **Items are narrowed only by a filter you pick on the page** (the Vault's universe chips, search and the Filters row); the filter row's **Clear all** brings the full list back.
- **Collection interests stay** (Account > Profile): they personalise Discover and the category shortcuts and never filter your own items.
- **Older saved preferences cannot hide anything.** No code reads the old `displayed_universes` account value any more (6 profiles still hold one; it is kept, not deleted, and is ignored). The old device copy (`vltd_visible_universe_chips`) is cleared the first time the Vault opens.
- Code: `lib/displayedUniverses.ts` and `components/DisplayedUniversesNotice.tsx` removed; `lib/universePrefs.ts` now reads interests only.

## Verified on production (RB60, isolated QA owner with the old setting on the account AND on the device)
| | Before (`rb60-before.json`) | After (`rb60-after.json`) |
|---|---|---|
| Home | 8 items shown of 26 | 26 items, same overview text as with no setting |
| Vault | 18 of 26, "hiding items" notice, Show menu | 26 of 26, no notice, no Show menu |
| Insights | filtered figures with notice | same figures as with no setting |
| Chip, then Clear all | Clear all stayed at 18 (the setting kept hiding) | chip narrows to 5, Clear all returns 26 |
| Account > Preferences | Universes displayed present | gone; interests still on Profile |
| Items in the database | 31 | 31 (nothing deleted) |

10 of 10 after. The first "before" run (`rb60-before-testmistake-wrongkey.json`) used a wrong universe key (`comics`; the real keys are upper case such as `POP_CULTURE`), so it hid nothing; it is kept as a test mistake and superseded by the corrected run.

QA fixture `uni` dropped; production vault items now read 3,508 = the 3,477 baseline + 31 items of the other QA fixture (`bnr`, owned by the banner/events session, dropped when that finishes).
