# Button-contrast checklist (2026-10-30)

Live site (vltd.app), Chrome phone emulation at 390 px (emulation, not a physical phone), synthetic collector, nothing paid. Text colour is measured as rendered (computed colour), and contrast is the WCAG ratio of that colour against both ends of the silver button gradient (#C8CDD2 and #8C9298). Pass = at least 4.5 on the light end and 3 on the dark end.

**Cause (all of them):** a global rule in `globals.css` (`button { color: inherit }`, not in a style layer) beats the Tailwind text class, so a button asking for dark text (`text-[#0B0B0B]`) gets the page's near-white text (`rgb(236,237,239)`): contrast 1.37 on the light end, 2.68 on the dark end. Fix used everywhere: the dark colour set inline on the element (the workaround already used elsewhere in the project). The global rule itself was not changed (it would restyle buttons site-wide).

## The eight remaining checks (one per source file)
| # | Where | Element | Before | Action | After (measured) | How it was checked |
|---|---|---|---|---|---|---|
| 1 | Account > Security (`PrivacyIdentityCards.tsx`) | Save button | not measured before the fix; same class pattern as the reproduced defect | inline dark text | rgb(11,11,11), 12.3 / 6.26 PASS | **real page**, rendered |
| 2 | Insurance item (`insurance/item/page.tsx`) | Print / Save as PDF button | already dark | none (a screen rule `.vltd-ins-primary` already forces it) | rgb(11,11,11), 12.3 / 6.26 PASS | **real page** |
| 3 | Insurance packet (`insurance/packet/page.tsx`) | Open Printable Page (link) | already dark | none (same rule) | 12.3 / 6.26 PASS | **real page** |
| 4 | Saved (`saved/page.tsx`) | Open The Flip (link) | **defect found by measuring**: light text on silver (my first read missed it because of a colour-format parsing slip in my script, caught in the same pass) | inline dark text | rgb(11,11,11), 12.3 / 6.26 PASS | **real page**; the link still goes to `/discover?flip=1` |
| 5 | Onboarding (`onboarding/page.tsx`) | the check mark badge (a div) | not a button, so the global rule does not apply | none | rgb(11,11,11), 12.3 / 6.26 PASS | **reproduced** (same element, classes and style on a live page); the onboarding page itself redirects a finished account, so it was not seen as rendered |
| 6 | Admin waitlist (`admin/waitlist/page.tsx`) | Approve & Invite (1 button) | defect reproduced: rgb(236,237,239), 1.37 / 2.68 | inline dark text | 12.3 / 6.26 PASS | **reproduced only** (see below) |
| 7 | Admin spotlights (`admin/spotlights/page.tsx`) | New and Save (2 buttons) | defect reproduced | inline dark text | 12.3 / 6.26 PASS | **reproduced only** |
| 8 | Admin museum campus (`admin/museum-campus/page.tsx`) | 5 buttons (save items per room, new program, save program, new store item, create/update store item) | defect reproduced | inline dark text | 12.3 / 6.26 PASS | **reproduced only** |

**"Reproduced only"** (6 to 8, and 5): the three admin pages cannot be opened by a test account, and no permission was changed to open them. Each button was rebuilt on a live page with the exact tag, classes and inline style from the source, measured as the source was (defect) and with the fix (pass). The code change is in; the real admin pages were **not** seen rendered.

Fixed earlier in this pass of work and re-measured live: Add Item "Take photo" and bulk "Add all N to Vault" (measured 12.3 against the light end of the silver; before the fix the bulk Save measured about 1.4); bulk "Scan with AI to fill details" is only shown to accounts with AI and was not measured.

## Affected flows, re-run in this pass
- Account > Security: entered a made-up birthdate, tapped Save: "Saved." shown, stored in the database, still there after a reload (PASS).
- Saved: "Open The Flip" goes to Discover's Flip view (PASS).
- The full functional pass (Add Item save + reload, single upload, bulk upload, exhibition create and builder edit, with the emulated keyboard) was **re-run on the current build: 26 of 26 PASS** (`functional-rerun-results.json`), because the earlier colour fix touched those buttons.

## Evidence
`contrast-eight-results.json` (final run), `first-run-results.json` (superseded: mis-parsed one colour and used a flawed reproduction for the admin buttons), `affected-flows-results.json`, `functional-rerun-results.json`, `screens/`, `scripts/`.
