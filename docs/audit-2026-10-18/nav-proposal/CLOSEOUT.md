# Navigation change: Browse menu and Account shortcuts (2026-10-22)

Deployed commit: **`38b3d01`** (live on vltd.app). Checks: `repair-batch-6/scripts/rb64-navigation.cjs` (final run 59 of 63 checks passed; the 4 that did not were test mistakes, superseded in ITM-763 to 766) and `rb64b-highlight.cjs` (6 of 6), on a synthetic account at 1440 px and at 390 px (touch is browser-emulated, not a physical phone). Unit tests: `npm run test:nav` (10 of 10).

## What changed
- Browse menu beside the title on Discover, Marketplace, Upcoming Comics and Events (Public collections, Marketplace, Upcoming Comics, Events); the current page is marked (dot, bold, `aria-current`) and focused on open. Built on the shared `ActionMenu`.
- The six-button row is removed from all six pages.
- Account menu, on desktop and phone: Saved, Watchlist, then Settings, Appearance, Invite Friends and the existing entries.
- Titles: Discover, Marketplace (was "VLTD Market"), Upcoming Comics, Events, Saved (was "Your Saves"), Watchlist. The Marketplace page's line "VLTD Market is contact-only" now says "The Marketplace is contact-only".
- Discover is highlighted on /discover, /market, /upcoming, /events only. Saved and Watchlist highlight nothing and show no Browse menu.
- Only one menu is open at a time (any menu that opens closes the others, including Help and the Add Item menus).

## Verified on the deployed site (desktop and phone)
Every destination by direct URL (title, highlight, Browse present or absent, no old row); Browse on each of the four pages (four items at the existing URLs, current marked and focused); Browse > Marketplace > Upcoming Comics > Events and browser Back retracing it; Account > Saved and Watchlist (own page, Discover not highlighted, menu closes) and Back; one menu at a time (by script and by a real click); Escape (focus returns to the button), outside press, choosing an item and Tab all dismiss; keyboard (Enter and Space open, arrows move and wrap, Enter opens the page); `?highlight=` event URL opens the event and Back returns to it; on a phone: rows at least 44 px, the Browse button's touch area reaches 44 px, a vertical drag starting on the button scrolls the page without opening anything, and scrolling with the menu open closes it.

## Notes (not part of this task)
- Page-level scroll closes any open menu (existing ActionMenu behaviour), so a page that scrolls by itself, such as an event link scrolling the event into view, closes a menu that was opened a moment earlier.
- A highlighted-event page scrolls the header out of view; the Browse button is reachable by scrolling up.
- The Marketplace page is too short to scroll for an account with no listings.
- Still open and separate: the automatic event refresh needs a real run. Physical phone: the owner verified the Home banner (swipe, vertical scroll, event opening, Seasonal theme on/off) on 2026-10-23; the Browse and Account menus were not named in that report, so their phone behaviour is still browser-emulated only.
