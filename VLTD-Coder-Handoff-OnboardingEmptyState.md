# VLTD — First-Run Empty State & Onboarding Welcome

**Philosophy:** A new collector signs up and sees "Items: 0 · Invested: $0 · Value: $0 · Gain: $0." That's demoralizing. The first 60 seconds after signup determines whether they add their first item or close the tab. Replace the empty dashboard with a purpose-built first-run experience that makes the next step obvious.

**Bug fixed in this handoff:** The dashboard currently says "Welcome back," — including on a brand new user's very first visit. Fixed below.

**Files changed:** 2 (`src/app/HomeClient.tsx`, `src/app/vault/page.tsx`)

---

## What changes

| Location | Current | After |
|----------|---------|-------|
| Dashboard greeting | "Welcome back," always | "Your vault is ready," for 0-item users |
| Dashboard stats row | 4 chips showing $0 $0 $0 $0 | Hidden on first load; replaced by action cards |
| Dashboard "Recently Added" empty | Small icon + 2 lines of text | 3-step guide with live CTAs |
| Vault empty state | 3 buttons in a row | Scanner as primary gold CTA; cleaner layout |

---

## Step 1 — HomeClient.tsx

### 1a — Fix "Welcome back" vs first-run greeting

Find the greeting text in the hero section:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[#A0956B]">
  Welcome back,
</p>
<h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">
  {displayName || "Collector"}
</h1>
<p className="mt-1 text-sm text-[#A0956B]">{summaryLine}</p>
```

Replace with:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[#A0956B]">
  {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
</p>
<h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">
  {displayName || "Collector"}
</h1>
{stats.totalItems > 0 && (
  <p className="mt-1 text-sm text-[#A0956B]">{summaryLine}</p>
)}
{stats.totalItems === 0 && (
  <p className="mt-1 text-sm text-[#A0956B]">
    Scan your first item to get started — it takes about 10 seconds.
  </p>
)}
```

---

### 1b — Hide the $0 stat chips on first load

Find the compact stats row:

```tsx
{/* Compact stats row */}
<div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
  <StatChip label="Items"    value={String(stats.totalItems)} sub="in vault" />
  <StatChip label="Invested" value={formatMoney(stats.totalCostValue)} sub="cost basis" />
  <StatChip label="Value"    value={formatMoney(stats.totalValue)} sub="current est." tone="gold" />
  <StatChip
    label="Gain / Loss"
    value={`${gainPrefix}${formatMoney(stats.totalGain)}`}
    sub={stats.totalCostValue > 0 ? `${gainPrefix}${stats.gainPct.toFixed(1)}% return` : "add costs"}
    tone={gainTone}
  />
</div>
```

Wrap the entire block in a conditional — only show stats when the vault has items:

```tsx
{stats.totalItems > 0 && (
  <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
    <StatChip label="Items"    value={String(stats.totalItems)} sub="in vault" />
    <StatChip label="Invested" value={formatMoney(stats.totalCostValue)} sub="cost basis" />
    <StatChip label="Value"    value={formatMoney(stats.totalValue)} sub="current est." tone="gold" />
    <StatChip
      label="Gain / Loss"
      value={`${gainPrefix}${formatMoney(stats.totalGain)}`}
      sub={stats.totalCostValue > 0 ? `${gainPrefix}${stats.gainPct.toFixed(1)}% return` : "add costs"}
      tone={gainTone}
    />
  </div>
)}
```

---

### 1c — Replace the "Recently Added" empty state with a 3-step first-run guide

Find the `recentItems.length === 0` block inside "Recently Added":

```tsx
{recentItems.length === 0 ? (
  <div
    className="mt-3 flex flex-col items-center rounded-2xl border border-dashed px-4 py-6 text-center"
    style={{ borderColor: "rgba(245,181,72,0.15)" }}
  >
    <IconPackagePlus size={28} style={{ color: "#A0956B", opacity: 0.6 }} />
    <p className="mt-2 text-sm font-semibold" style={{ color: "#A0956B" }}>
      Start building your collection
    </p>
    <p className="mt-0.5 text-xs" style={{ color: "#5A5040" }}>
      Use Smart Scan or Quick Add to catalog your first item.
    </p>
  </div>
```

Replace with:

```tsx
{recentItems.length === 0 ? (
  <div className="mt-3 space-y-2">
    {/* Step 1 */}
    <Link
      href="/vault/quick"
      className="flex items-center gap-3 rounded-[16px] px-4 py-3.5 transition hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(135deg, rgba(245,181,72,0.12), rgba(245,181,72,0.06))",
        border: "1px solid rgba(245,181,72,0.28)",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black"
        style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548" }}
      >
        1
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: "#F5B548" }}>
          Scan your first item
        </p>
        <p className="text-xs" style={{ color: "#A0956B" }}>
          Open Quick Add — camera locks when your item is framed
        </p>
      </div>
      <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5B548" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>

    {/* Step 2 */}
    <Link
      href="/vault"
      className="flex items-center gap-3 rounded-[16px] px-4 py-3.5 transition hover:brightness-105"
      style={{
        background: "var(--theme-elevated, rgba(20,32,55,0.9))",
        border: "1px solid var(--theme-border, rgba(245,181,72,0.10))",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black"
        style={{ background: "rgba(255,255,255,0.06)", color: "#A0956B" }}
      >
        2
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
          Browse your vault
        </p>
        <p className="text-xs" style={{ color: "#A0956B" }}>
          Seven universes — TCG, Sports, Comics, Music, Games, Jewelry, Misc
        </p>
      </div>
      <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A0956B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>

    {/* Step 3 */}
    <Link
      href="/vault"
      className="flex items-center gap-3 rounded-[16px] px-4 py-3.5 transition hover:brightness-105"
      style={{
        background: "var(--theme-elevated, rgba(20,32,55,0.9))",
        border: "1px solid var(--theme-border, rgba(245,181,72,0.10))",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black"
        style={{ background: "rgba(255,255,255,0.06)", color: "#A0956B" }}
      >
        3
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
          Share your vault
        </p>
        <p className="text-xs" style={{ color: "#A0956B" }}>
          Tap "Share vault" in your vault to get a public link — no login required to view
        </p>
      </div>
      <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A0956B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  </div>
```

---

## Step 2 — vault/page.tsx

The `VaultEmptyState` component already exists and is decent. Two targeted changes: make Quick Add the obvious gold primary action, and add a "What is a Universe?" helper line for new users who don't know the terminology.

### 2a — Make Quick Add the gold primary button

Find the VaultEmptyState button group:

```tsx
<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
  <Link
    href="/vault/quick"
    className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
  >
    Quick Add
  </Link>
  <Link
    href="/vault/add"
    className="vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
  >
    Add Item
  </Link>
  <Link
    href="/vault/import"
    className="vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
  >
    Import
  </Link>
</div>
```

Replace with:

```tsx
<div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
  <Link
    href="/vault/quick"
    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition hover:opacity-90 sm:w-auto"
    style={{ background: "#F5B548", color: "#0B0B0B" }}
  >
    {/* Camera icon */}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.75 7.25 10.1 5.5h3.8l1.35 1.75h2.25A2.5 2.5 0 0 1 20 9.75v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.25v-6.5a2.5 2.5 0 0 1 2.5-2.5h2.25Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="12" cy="12.5" r="3.25" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
    Scan your first item
  </Link>
  <div className="flex gap-2">
    <Link
      href="/vault/add"
      className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
      style={{ color: "var(--fg)" }}
    >
      Add manually
    </Link>
    <Link
      href="/vault/import"
      className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
      style={{ color: "var(--fg)" }}
    >
      Import
    </Link>
  </div>
</div>
```

### 2b — Update the empty state description and add Universe explainer

Find:

```tsx
<h2 className="mt-2 text-2xl font-semibold">You have no items yet</h2>
<div className="mt-2 text-sm text-[color:var(--muted)]">
  Start with Quick Add for the fastest path, or use Add for scan-assisted entry with pricing and images.
</div>
```

Replace with:

```tsx
<h2 className="mt-2 text-2xl font-semibold">Your vault is empty — let's fix that.</h2>
<div className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
  Scan an item with the camera and VLTD identifies it automatically — universe, category, and current market value. Takes about 10 seconds per item.
</div>
<div
  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
  style={{ background: "rgba(245,181,72,0.08)", border: "1px solid rgba(245,181,72,0.15)", color: "#A0956B" }}
>
  <span>Universes are top-level categories:</span>
  <span style={{ color: "#F5B548" }}>TCG · Sports · Comics · Music · Games · Jewelry · Misc</span>
</div>
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] New user (0 items): dashboard shows "Your vault is ready," — NOT "Welcome back,"
- [ ] New user: stat chips ($0 $0 $0 $0) are hidden entirely
- [ ] New user: "Recently Added" section shows 3 numbered step cards with working links
- [ ] Step 1 card links to `/vault/quick` (the scanner)
- [ ] Step 2 card links to `/vault`
- [ ] Step 3 card links to `/vault` (share vault button is in the vault header)
- [ ] Returning user with items: "Welcome back," greeting restored, stat chips visible, recently added items shown normally
- [ ] Vault empty state: "Scan your first item" is a gold full-width button on mobile, auto-width on desktop
- [ ] Vault empty state: "Add manually" and "Import" are secondary pills beside it
- [ ] Universe explainer pill visible below the description
- [ ] TypeScript passes with no new errors

Commit: `feat: first-run empty state — welcome greeting, hidden $0 stats, 3-step guide, scanner as primary vault CTA`
