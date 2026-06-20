# VLTD — Gallery/Exhibition Hero Panel Fix

The hero section on `src/app/museum/[galleryId]/page.tsx` is too tall — it doesn't fit on one screen. Four causes: excessive padding, oversized title, 4 stat cards in a 2×2 grid, and too much spacing before the share link section. All surgical changes to the JSX, no logic touched.

---

## Change 1 — Shrink hero section padding

**Find (line ~721):**
```tsx
<section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-8 lg:p-10">
```

**Replace with:**
```tsx
<section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.38)] sm:p-5">
```

---

## Change 2 — Tighten the Save/Cancel button row spacing

**Find (line ~739):**
```tsx
<div className="mb-6 flex flex-wrap items-center gap-3">
```

**Replace with:**
```tsx
<div className="mb-3 flex flex-wrap items-center gap-2">
```

---

## Change 3 — Shrink the title

**Find (line ~774):**
```tsx
<h1 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
```

**Replace with:**
```tsx
<h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
```

---

## Change 4 — Shrink the description

**Find (line ~778):**
```tsx
<p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
```

**Replace with:**
```tsx
<p className="mt-1 max-w-2xl text-sm leading-5 text-[color:var(--muted)]">
```

---

## Change 5 — Tighten the chips row

**Find (line ~784):**
```tsx
<div className="mt-5 flex flex-wrap items-center gap-2">
```

**Replace with:**
```tsx
<div className="mt-3 flex flex-wrap items-center gap-1.5">
```

---

## Change 6 — Replace the 2×2 stats grid with a compact horizontal strip

This is the biggest gain. The four large padded stat cards are the main reason the hero is so tall. Replace them with a slim inline stat row.

**Find this entire block (lines ~803–850):**
```tsx
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    GALLERY VALUE
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalValue)}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Current exhibit value
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    ROI
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metrics.roi >= 0 ? "+" : ""}
                    {metrics.roi.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Based on purchase totals
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    NOTES COVERAGE
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metrics.notesCoverage.toFixed(0)}%
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {metrics.notesCount} noted exhibits
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    LAST VIEWED
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {formatDateTime(draft.analytics?.lastViewedAt)}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Latest tracked access time
                  </div>
                </div>
              </div>
```

**Replace with:**
```tsx
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">VALUE</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight">{formatMoney(metrics.totalValue)}</div>
                </div>

                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">ROI</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight">
                    {metrics.roi >= 0 ? "+" : ""}{metrics.roi.toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">NOTES</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight">{metrics.notesCoverage.toFixed(0)}%</div>
                </div>

                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">VIEWS</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight">{metrics.views}</div>
                </div>
              </div>
```

---

## Change 7 — Tighten spacing before the share link section

**Find (line ~853):**
```tsx
        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
```

**Replace with:**
```tsx
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Exhibition hero panel fits on one screen at 1280px+ without scrolling
- [ ] Cover image still shows as blurred background behind the hero
- [ ] Save Changes / Cancel Changes buttons still function correctly
- [ ] All 4 stat values still display (Value, ROI, Notes, Views)
- [ ] Public Share Link and Cover Image sections visible below hero without scrolling
- [ ] Access mode pills (Private / Public Gallery / Guest View / Registered Users) still visible
- [ ] Mobile (375px): hero is compact, content stacks cleanly

Commit: `fix: gallery hero panel — compact layout, slim stats strip, fits on one screen`
