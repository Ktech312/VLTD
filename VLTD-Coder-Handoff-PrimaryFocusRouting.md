# VLTD — Wire primary_focus to Vault Universe Routing

**Philosophy:** A collector told us what they care about during onboarding. We've been storing it but ignoring it. Two small changes fix this: (1) the dashboard Focus badge becomes a shortcut to their universe, (2) the vault universe grid surfaces their focus universe first so they don't have to scroll-hunt.

**Files changed:** 2 (`src/app/HomeClient.tsx`, `src/app/vault/page.tsx`)

---

## What primary_focus currently contains

The field stores the raw string the collector picked from this dropdown:
```
"Sports Cards" | "TCG" | "Comics" | "Toys" | "Memorabilia" | "Watches" | "Mixed Collection"
```
It's already read back into state in `HomeClient.tsx` (`status.activeProfile?.primary_focus`) and displayed as a gold chip in the dashboard header. It's never acted on.

---

## Step 1 — Cache the focus in localStorage

`vault/page.tsx` doesn't fetch from Supabase on load (it reads from `loadItems()` and `vaultCloud.ts`). To avoid adding a Supabase round-trip, cache the focus value in localStorage whenever HomeClient reads it.

**File: `src/app/HomeClient.tsx`**

Find the block where `setPrimaryFocus` is called (inside the `load()` async function):

```ts
setPrimaryFocus(status.activeProfile?.primary_focus ?? "");
```

Add one line immediately after:

```ts
setPrimaryFocus(status.activeProfile?.primary_focus ?? "");
// Cache for vault page (avoids extra Supabase call)
const focus = status.activeProfile?.primary_focus ?? "";
if (typeof window !== "undefined" && focus) {
  window.localStorage.setItem("vltd_primary_focus_v1", focus);
}
```

---

## Step 2 — Make the Focus badge a link

Still in `HomeClient.tsx`, find the Focus badge JSX:

```tsx
{primaryFocus && primaryFocus.toLowerCase() !== "null" && (
  <div
    className="shrink-0 rounded-2xl border px-3 py-1.5 text-right"
    style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)" }}
  >
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#A0956B]">Focus</p>
    <p className="text-sm font-bold text-[#F5B548]">{primaryFocus}</p>
  </div>
)}
```

Replace with a linked version:

```tsx
{primaryFocus && primaryFocus.toLowerCase() !== "null" && (
  <Link
    href={focusVaultHref(primaryFocus)}
    className="shrink-0 rounded-2xl border px-3 py-1.5 text-right transition hover:opacity-80"
    style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)" }}
  >
    <p className="text-[10px] uppercase tracking-[0.18em] text-[#A0956B]">Focus →</p>
    <p className="text-sm font-bold text-[#F5B548]">{primaryFocus}</p>
  </Link>
)}
```

Add the helper function at module scope in `HomeClient.tsx` (above the component):

```ts
function focusVaultHref(focus: string): string {
  const f = focus.trim().toLowerCase();
  if (f === "sports cards" || f === "memorabilia") return "/vault/sports";
  if (f === "tcg") return "/vault/tcg";
  if (f === "comics" || f === "toys") return "/vault/pop-culture";
  if (f === "watches") return "/vault/jewelry-apparel";
  return "/vault"; // Mixed Collection or unrecognized → full vault
}
```

Make sure `Link` is imported at the top (it already should be).

---

## Step 3 — Sort the focus universe to the top of the vault grid

**File: `src/app/vault/page.tsx`**

### 3a — Add a helper to read the cached focus

Add this function near the top of the file (after the imports, before the component):

```ts
function getVaultFocusUniverse(): UniverseKey | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("vltd_primary_focus_v1") ?? "";
  if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "mixed collection") return null;
  return directUniverseMatch(raw) || null;
}
```

`directUniverseMatch` is already defined in this file — no imports needed.

### 3b — Read it in state on mount

Add a piece of state to the `VaultPage` component:

```ts
const [focusUniverse, setFocusUniverse] = useState<UniverseKey | null>(null);
```

Set it in the existing `useEffect` that calls `hydrateAll()` (add before `void hydrateAll()`):

```ts
setFocusUniverse(getVaultFocusUniverse());
```

### 3c — Sort the universe grid

Find where `VAULT_UNIVERSES` is mapped for the UniverseOverviewCard grid:

```tsx
{VAULT_UNIVERSES.map((category) => (
  <UniverseOverviewCard
    key={category.key}
    category={category}
    items={universeGroups[category.key]}
    className=""
  />
))}
```

Replace with a sorted version:

```tsx
{[...VAULT_UNIVERSES]
  .sort((a, b) => {
    if (focusUniverse && a.key === focusUniverse) return -1;
    if (focusUniverse && b.key === focusUniverse) return 1;
    return 0;
  })
  .map((category) => (
    <UniverseOverviewCard
      key={category.key}
      category={category}
      items={universeGroups[category.key]}
      focusHighlight={focusUniverse === category.key}
    />
  ))}
```

### 3d — Add the focusHighlight prop to UniverseOverviewCard

Find the `UniverseOverviewCard` function signature:

```tsx
function UniverseOverviewCard({
  category,
  items,
  className = "",
}: {
  category: (typeof VAULT_UNIVERSES)[number];
  items: VaultItem[];
  className?: string;
})
```

Add the new prop:

```tsx
function UniverseOverviewCard({
  category,
  items,
  className = "",
  focusHighlight = false,
}: {
  category: (typeof VAULT_UNIVERSES)[number];
  items: VaultItem[];
  className?: string;
  focusHighlight?: boolean;
})
```

Then inside the component, find the universe label line:

```tsx
<h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: "var(--theme-gold, #F5B548)" }}>
  {universeDisplayName(category.key)}
</h2>
```

Replace with:

```tsx
<h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: "var(--theme-gold, #F5B548)" }}>
  {universeDisplayName(category.key)}
  {focusHighlight && (
    <span
      className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: "rgba(245,181,72,0.55)" }}
    >
      · Your Focus
    </span>
  )}
</h2>
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Collector with primary_focus "TCG" → Focus badge on dashboard links to `/vault/tcg`
- [ ] Collector with primary_focus "Sports Cards" → badge links to `/vault/sports`
- [ ] Collector with "Mixed Collection" → badge links to `/vault` (root)
- [ ] After visiting dashboard, opening vault page → TCG/Sports universe card sorts to top of the grid with "· Your Focus" label
- [ ] Collector with no primary_focus → no badge, no reordering, vault grid unchanged
- [ ] TypeScript passes with no new errors

Commit: `feat: wire primary_focus to vault routing — focus badge links to universe, vault grid sorts focus to top`
