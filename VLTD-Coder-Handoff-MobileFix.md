# VLTD — Mobile Navigation & Layout Fix

**Files:** 3
- `src/components/BottomNav.tsx`
- `src/components/TopNav.tsx`
- `src/app/globals.css`

This is the structural mobile fix. Three surgical changes.
After these ship, do a hard reload on an actual phone before reporting results.

---

## Problem summary

On mobile (< 768px), the app currently:
1. **Has no Vault link** in the bottom nav — the most important feature is unreachable by tap
2. **Wastes 102px at the top** — a 64px nav bar with no nav links + a 38px search row, just to show the logo
3. **All sizes and padding are desktop-sized** — no mobile-specific reductions

---

## Fix 1 — BottomNav.tsx: Fix the routes

The current TABS array has "Discover" linking to `/vault` (wrong) and no Vault tab at all.

Find the TABS array:

```tsx
const TABS: (Tab | null)[] = [
  { label: "Home",        href: "/",         icon: IconHome,        exact: true  },
  { label: "Exhibitions", href: "/museum",    icon: IconExhibitions, exact: false },
  null, // gold + button (capture)
  { label: "Discover",    href: "/vault",     icon: IconDiscover,    exact: false },
  { label: "Activity",    href: "/portfolio", icon: IconActivity,    exact: false },
];
```

Replace with:

```tsx
const TABS: (Tab | null)[] = [
  { label: "Home",     href: "/",         icon: IconHome,        exact: true  },
  { label: "Vault",    href: "/vault",     icon: IconDiscover,    exact: false },
  null, // gold + button (capture)
  { label: "Discover", href: "/discover",  icon: IconExhibitions, exact: false },
  { label: "Activity", href: "/portfolio", icon: IconActivity,    exact: false },
];
```

**Note:** Reuse existing icon components for now — the exact icon assignments can be refined later. The priority is that Vault (`/vault`) and Discover (`/discover`) go to the right pages.

---

## Fix 2 — TopNav.tsx: Remove the mobile search row

On mobile, the top nav has a 38px search row below the main 64px bar (`md:hidden` div at the bottom of the nav). This inflates the top nav to 102px and adds zero nav value — search is already available via the search icon in the top-right of the main bar.

Find this block (near the bottom of the nav JSX, before the closing `</div>` of the outer sticky container):

```tsx
{/* ── Mobile search row ── */}
<div className="px-4 pb-2.5 pt-2 md:hidden" style={{ borderTop: "1px solid rgba(245,181,72,0.08)" }}>
  <form onSubmit={(e) => { e.preventDefault(); applySearch(input); }}>
    <div
      className="flex h-[38px] items-center rounded-full px-3"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <button type="submit" className="shrink-0" style={{ color: "#5A5040" }} aria-label="Search">
        <IconSearch className="h-3.5 w-3.5" />
      </button>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search vault, exhibitions, collectors…"
        className="ml-2 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
      />
    </div>
  </form>
</div>
```

**Delete this entire block.** The search icon in the top-right header already opens search on mobile.

---

## Fix 3 — globals.css: Reduce mobile top nav height

After removing the search row in Fix 2, `--topnav-h` on mobile needs to match just the main bar height (64px), not the old combined 102px.

Find:

```css
/* Mobile: main bar (56px) + slim search row (46px) */
@media (max-width: 767px) {
  :root {
    --topnav-h: 102px;
  }
}
```

Replace with:

```css
/* Mobile: main bar only (search row removed) */
@media (max-width: 767px) {
  :root {
    --topnav-h: 64px;
  }
}
```

This saves **38px of content space** on every single page on mobile. Since `vltd-content-wrap` uses `paddingTop: var(--topnav-h)`, this takes effect everywhere automatically with no other changes.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

**Test on an actual phone — not a desktop browser window resized to narrow.**

Test checklist:
- [ ] Bottom nav shows: Home · Vault · + · Discover · Activity
- [ ] Tapping "Vault" goes to `/vault`
- [ ] Tapping "Discover" goes to `/discover`
- [ ] Tapping "+" goes to `/capture`
- [ ] Top nav is 64px tall on phone, not 102px
- [ ] Every page has 38px more visible content space at the top on mobile
- [ ] Search still works via the search icon in the top-right of the nav bar

Commit: `fix(mobile): vault in bottom nav, remove mobile search row, reduce topnav height 102→64px`
