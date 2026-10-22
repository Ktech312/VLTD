# Navigation proposal: Browse menu on Discover, Saved and Watchlist in the Account menu

Status: **proposal only, nothing in the app has changed.** The mockups are the live pages with their DOM edited in memory in a test browser (`make-mockups.cjs` here), so they use the app's real styling.

## What exists today (inspected)
- **Main bar** (`lib/primaryNav.ts`, read by `TopNav.tsx` at 768 px and up and by `BottomNav.tsx` under 768 px): Home, Vault, Exhibitions, Lounge, Discover. Discover is highlighted for `/discover`, `/saved`, `/watchlist`, `/market`, `/upcoming` and `/events`.
- **The six-button row** is `DiscoverNav` in `components/SectionNav.tsx` (Explore, Saved, Watchlist, Marketplace, Upcoming Comics, Events). It is placed under the page header on `/discover`, `/saved`, `/watchlist`, `/market`, `/upcoming` and `/events`.
- **Account menu**: one component in `TopNav.tsx`, used on desktop and phone (the avatar at the top right). Rows today: profile header and level, Switch Profile, Settings, Appearance, Invite Friends, and on phones only Getting started, Feature guide and Support; footer: Admin (admins) and Sign Out. On a phone it is capped to the screen height and scrolls inside itself.
- **Page titles today:** Discover = "Discover", Marketplace = "VLTD Market", Upcoming Comics = "Upcoming Comics", Events = "Events", Saved = "Your Saves", Watchlist = "Watchlist". The routes are `/discover`, `/market`, `/upcoming`, `/events`, `/saved`, `/watchlist`; Events already accepts `?highlight=<slug>`.
- Other places that mention these routes and stay as they are: the command palette, robots, route access, the mobile Add Item route list.

## Mockups (what to approve)
1. `nav-mockup-desktop.jpg`: Discover page, Browse menu open beside the heading and the Account menu open with Saved and Watchlist (both open in one frame for review; in the app one closes when the other opens). The six-button row is gone and Discover stays highlighted in the main bar.
2. `nav-mockup-mobile-browse.jpg`: phone, Browse menu open (spans the screen width under the heading).
3. `nav-mockup-mobile-account.jpg`: phone, Account menu open with Saved and Watchlist above Settings.
4. For comparison: `nav-before-desktop.jpg`, `nav-before-mobile.jpg`.

## The arrangement
- **Browse menu**: a compact "Browse" button right of the page title, opening four items: Public collections (`/discover`), Marketplace (`/market`), Upcoming Comics (`/upcoming`), Events (`/events`). The current page is marked (dot, bold, `aria-current`). The button label stays "Browse".
- **Account menu**: Saved (`/saved`) and Watchlist (`/watchlist`) as the first two rows of the link group, above Settings, on desktop and phone.
- **Active states**: Discover is highlighted on `/discover`, `/market`, `/upcoming`, `/events`. It is **not** highlighted on `/saved` and `/watchlist`, and those two pages get no Browse menu, so they do not read as Discover subsections. (Nothing else in the main bar is highlighted there either.)
- **Unchanged**: every URL, each page's own title and functions, event highlights (`?highlight=`), filters, browser Back.

## Decisions I need from you (my assumptions in brackets)
1. **Browse menu on all four public pages?** [Yes: Discover, Marketplace, Upcoming Comics and Events each show it beside their own title, so you can move between them. Otherwise the highlight would send you to Discover with no way across.]
2. **Labels versus titles** [menu says "Public collections", "Marketplace", "Saved"; the pages keep their titles "Discover", "VLTD Market", "Your Saves"]. Say if you want any title changed; I will not change titles unasked.
3. **Order in the Account menu** [Saved, Watchlist, then Settings, Appearance, Invite Friends].

## Implementation plan (after approval)
- `lib/primaryNav.ts`: Discover's match list drops `/saved` and `/watchlist`; one shared list for the Browse items and one for the Account shortcuts.
- One shared `BrowseMenu` component (button, menu, keyboard, dismissal) placed in the `PageHeader` title row on the four pages; the Account menu rows come from the shared list in `TopNav.tsx`.
- `SectionNav.tsx`: `DiscoverNav` and the six-button row removed; Lounge and Vault navigation untouched.
- Header strips must sit above the page content under them so an open menu is not covered (the mockup needed that too).
- Verification: all six destinations from desktop and phone, active states, menu close (Esc, outside click, choosing an item, route change), keyboard (open, arrows, Tab, Esc returns focus), touch targets at least 44 px on phones, direct URLs and bookmarks, event highlight links, browser Back, then screenshots on the deployed site.

## Findings recorded, not part of this task
- The page titles are inconsistent with the menu names ("VLTD Market", "Your Saves").
- Page header widths differ per page (`max-w-6xl`, `900px`, `1360px`, `1480px`), so the title row sits at slightly different positions; the Browse button sits right of the title on each.
- The phone Account menu already scrolls inside itself; two more rows add about 88 px to it.
