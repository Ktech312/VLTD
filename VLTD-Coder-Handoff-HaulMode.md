# VLTD — Task 3: Haul Mode / Bulk Rapid Scan

Adds a persistent scan session that keeps the camera live between items, shows a real-time HUD, and ends with a batch review + social share screen. Biggest onboarding friction reducer: instead of navigating back to /vault/add after every card, collectors just scan their whole pile in one pass.

---

## Context: current single-scan flow

`/vault/add` has:
- `ScanPanel` + `CameraCapturePanel` — capture one image, run OCR/vision, autofill form
- `BulkAddState` — field locks that persist universe/category across items
- `appendItems()` — saves the item, then the user navigates back for the next one

Haul Mode wraps this loop with a persistent session layer. Camera stays open. Items queue up. Review happens at the end.

---

## Step 1 — Create `src/lib/haulSession.ts`

New file — all the haul state logic, zero React:

```typescript
export type HaulItem = {
  id: string;                    // nanoid, matches VaultItem.id that gets saved
  title: string;
  subtitle?: string;
  universe?: string;
  categoryLabel?: string;
  grade?: string;
  currentValue?: number;
  imageFrontUrl?: string;        // object URL for preview
  scanConfidence?: "low" | "medium" | "high";
  status: "pending" | "saved" | "skipped";
  addedAt: number;
};

export type HaulSession = {
  id: string;
  name: string;                  // e.g. "May 14 Haul"
  startedAt: number;
  items: HaulItem[];
};

const HAUL_STORAGE_KEY = "vltd_haul_session_v1";

function todayName(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " Haul";
}

export function createHaulSession(): HaulSession {
  return {
    id: crypto.randomUUID(),
    name: todayName(),
    startedAt: Date.now(),
    items: [],
  };
}

export function loadHaulSession(): HaulSession | null {
  try {
    const raw = localStorage.getItem(HAUL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !Array.isArray(parsed?.items)) return null;
    return parsed as HaulSession;
  } catch {
    return null;
  }
}

export function saveHaulSession(session: HaulSession): void {
  try {
    localStorage.setItem(HAUL_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearHaulSession(): void {
  try {
    localStorage.removeItem(HAUL_STORAGE_KEY);
  } catch {}
}

export function addHaulItem(session: HaulSession, item: HaulItem): HaulSession {
  return { ...session, items: [...session.items, item] };
}

export function updateHaulItemStatus(
  session: HaulSession,
  itemId: string,
  status: HaulItem["status"]
): HaulSession {
  return {
    ...session,
    items: session.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
  };
}

export function haulSessionStats(session: HaulSession) {
  const saved = session.items.filter((i) => i.status === "saved");
  const totalValue = saved.reduce((sum, i) => sum + (i.currentValue ?? 0), 0);
  return { count: saved.length, total: session.items.length, totalValue };
}
```

---

## Step 2 — Add Haul Mode toggle to `/vault/add`

**File:** `src/app/vault/add/page.tsx`

### 2a — Add haul state

Near the top of the component, alongside existing state:

```typescript
const [haulMode, setHaulMode] = useState(false);
const [haulSession, setHaulSession] = useState<HaulSession | null>(null);
const [showHaulReview, setShowHaulReview] = useState(false);
```

On mount, resume any in-progress haul:
```typescript
useEffect(() => {
  const existing = loadHaulSession();
  if (existing && existing.items.length > 0) {
    setHaulSession(existing);
    setHaulMode(true);
  }
}, []);
```

### 2b — Start haul

```typescript
function startHaul() {
  const session = createHaulSession();
  saveHaulSession(session);
  setHaulSession(session);
  setHaulMode(true);
}

function endHaul() {
  setShowHaulReview(true);
}
```

### 2c — After each item saves, queue to haul instead of resetting

Find where `appendItems()` is called after form submit. Wrap it:

```typescript
// After appendItems() succeeds, add to haul session if active
if (haulMode && haulSession) {
  const haulItem: HaulItem = {
    id: savedItem.id,
    title: savedItem.title,
    subtitle: savedItem.subtitle,
    universe: savedItem.universe,
    categoryLabel: savedItem.categoryLabel,
    grade: savedItem.grade,
    currentValue: savedItem.currentValue,
    imageFrontUrl: savedItem.imageFrontUrl,
    scanConfidence: scanSession.review?.confidence,
    status: "saved",
    addedAt: Date.now(),
  };
  const next = addHaulItem(haulSession, haulItem);
  saveHaulSession(next);
  setHaulSession(next);
  // Reset form for next item but DON'T navigate away
  resetFormForNextItem();   // see Step 2d
} else {
  router.push("/vault");
}
```

### 2d — `resetFormForNextItem()`

```typescript
function resetFormForNextItem() {
  // Apply locks (universe/category carry over, title/grade clear)
  setValues(resetUnlockedBulkValues(values, locks));
  setScanSession(clearScanSession());
  setDraftImages([]);
  setPricingValues(EMPTY_PRICING_VALUES);
  // Scroll back to top / re-open camera
  window.scrollTo({ top: 0, behavior: "smooth" });
  // Re-trigger camera open if CameraCapturePanel supports an `autoOpen` prop
  // (see Step 2e)
}
```

### 2e — Keep camera live between scans

In the `CameraCapturePanel` call, add an `autoOpen` prop that fires when haul mode is active and the scan state resets to idle:

```tsx
<CameraCapturePanel
  // ... existing props ...
  autoOpen={haulMode && scanSession.status === "idle"}
/>
```

**In `CameraCapturePanel.tsx`**, add:
```typescript
useEffect(() => {
  if (props.autoOpen) {
    // trigger the same "Open Camera" click programmatically
    openCamera();   // whatever internal function opens the stream
  }
}, [props.autoOpen]);
```

---

## Step 3 — Haul HUD

A fixed bottom bar that shows while haul mode is active. Render it in `/vault/add` when `haulMode && haulSession && !showHaulReview`:

```tsx
{haulMode && haulSession && !showHaulReview && (
  <div
    className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3 border-t"
    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
  >
    {/* Session name + item count */}
    <div>
      <div className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
        {haulSession.name}
      </div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {haulSessionStats(haulSession).count} item
        {haulSessionStats(haulSession).count !== 1 ? "s" : ""} saved
        {haulSessionStats(haulSession).totalValue > 0
          ? ` · $${haulSessionStats(haulSession).totalValue.toLocaleString()} est. value`
          : ""}
      </div>
    </div>

    {/* End session button */}
    <button
      type="button"
      onClick={endHaul}
      className="rounded-full px-4 py-2 text-[12px] font-semibold"
      style={{ background: "var(--theme-gold, #F5B548)", color: "#000" }}
    >
      Done · Review
    </button>
  </div>
)}
```

Add `pb-20` to the main form container when `haulMode` is true so the HUD doesn't cover the save button.

---

## Step 4 — Haul Mode toggle button

In the header area of `/vault/add`, next to existing action buttons, add:

```tsx
{!haulMode ? (
  <button
    type="button"
    onClick={startHaul}
    className="rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition"
    style={{
      background: "var(--surface)",
      color: "var(--muted)",
      borderColor: "var(--border)",
    }}
  >
    ⚡ Haul Mode
  </button>
) : (
  <button
    type="button"
    onClick={endHaul}
    className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
    style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
  >
    ● Live · {haulSessionStats(haulSession!).count}
  </button>
)}
```

---

## Step 5 — Create `src/components/HaulReviewSheet.tsx`

End-of-session review. Full-screen bottom sheet modal showing all captured items:

```tsx
"use client";

import { useState } from "react";
import type { HaulSession, HaulItem } from "@/lib/haulSession";
import { haulSessionStats, clearHaulSession, updateHaulItemStatus } from "@/lib/haulSession";
import { deleteItemById } from "@/lib/vaultModel";   // or whatever the remove function is

type Props = {
  session: HaulSession;
  onClose: () => void;
  onFinish: () => void;
};

export default function HaulReviewSheet({ session, onClose, onFinish }: Props) {
  const [items, setItems] = useState(session.items);
  const stats = haulSessionStats({ ...session, items });

  function skipItem(id: string) {
    // Remove from vault + mark skipped
    deleteItemById(id);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "skipped" } : i))
    );
  }

  function finish() {
    clearHaulSession();
    onFinish();
  }

  const saved = items.filter((i) => i.status === "saved");
  const skipped = items.filter((i) => i.status === "skipped");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <div className="text-[17px] font-bold" style={{ color: "var(--fg)" }}>
            {session.name}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {stats.count} item{stats.count !== 1 ? "s" : ""}
            {stats.totalValue > 0 ? ` · $${stats.totalValue.toLocaleString()} est. value` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] font-semibold"
          style={{ color: "var(--muted)" }}
        >
          Back
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {saved.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-2xl p-3 ring-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {/* Thumbnail */}
            {item.imageFrontUrl && (
              <img
                src={item.imageFrontUrl}
                alt={item.title}
                className="h-14 w-10 object-cover rounded-xl flex-shrink-0"
              />
            )}
            {!item.imageFrontUrl && (
              <div
                className="h-14 w-10 rounded-xl flex-shrink-0"
                style={{ background: "var(--pill)" }}
              />
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: "var(--fg)" }}>
                {item.title}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                {[item.categoryLabel, item.grade].filter(Boolean).join(" · ")}
              </div>
              {item.currentValue ? (
                <div className="text-[11px] font-semibold" style={{ color: "var(--theme-gold, #F5B548)" }}>
                  ${item.currentValue.toLocaleString()}
                </div>
              ) : null}
            </div>

            {/* Confidence badge + remove */}
            <div className="flex flex-col items-end gap-1.5">
              {item.scanConfidence === "low" && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    color: "#f87171",
                    borderColor: "rgba(239,68,68,0.35)",
                  }}
                >
                  Low confidence
                </span>
              )}
              <button
                type="button"
                onClick={() => skipItem(item.id)}
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {skipped.length > 0 && (
          <div
            className="text-[12px] text-center py-2"
            style={{ color: "var(--muted)" }}
          >
            {skipped.length} item{skipped.length !== 1 ? "s" : ""} removed
          </div>
        )}
      </div>

      {/* Share + Finish footer */}
      <div
        className="px-5 py-4 border-t space-y-3"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Share your haul */}
        {saved.length >= 3 && (
          <button
            type="button"
            onClick={() => {
              const text = `Just added ${saved.length} items to my vault on VLTD — est. value $${stats.totalValue.toLocaleString()}. ${session.name} 🎴`;
              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).catch(() => {});
              }
            }}
            className="w-full rounded-2xl py-3 text-[14px] font-semibold ring-1"
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              borderColor: "var(--border)",
            }}
          >
            Share your haul ↗
          </button>
        )}

        {/* Finish */}
        <button
          type="button"
          onClick={finish}
          className="w-full rounded-2xl py-3 text-[14px] font-semibold"
          style={{ background: "var(--theme-gold, #F5B548)", color: "#000" }}
        >
          Done — Go to Vault
        </button>
      </div>
    </div>
  );
}
```

---

## Step 6 — Wire HaulReviewSheet into add page

In `/vault/add/page.tsx`, render the sheet:

```tsx
{showHaulReview && haulSession && (
  <HaulReviewSheet
    session={haulSession}
    onClose={() => setShowHaulReview(false)}
    onFinish={() => {
      setHaulMode(false);
      setHaulSession(null);
      setShowHaulReview(false);
      router.push("/vault");
    }}
  />
)}
```

---

## Step 7 — Haul entry point on vault home

**File:** `src/app/vault/VaultInner.tsx` (or vault page header)

Add a "Start Haul" shortcut button visible when the vault has items (not during first-time empty state):

```tsx
<Link
  href="/vault/add"
  onClick={() => {
    // Pre-seed haul mode flag so add page auto-starts haul
    localStorage.setItem("vltd_haul_autostart_v1", "1");
  }}
  className="rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1"
  style={{ background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}
>
  ⚡ Haul Mode
</Link>
```

In `/vault/add/page.tsx`, on mount:
```typescript
useEffect(() => {
  const flag = localStorage.getItem("vltd_haul_autostart_v1");
  if (flag === "1") {
    localStorage.removeItem("vltd_haul_autostart_v1");
    startHaul();
  }
}, []);
```

---

## New file summary

| File | Change |
|------|--------|
| `src/lib/haulSession.ts` | New — HaulSession type, CRUD, stats helpers |
| `src/components/HaulReviewSheet.tsx` | New — end-of-session review + share |
| `src/app/vault/add/page.tsx` | Haul state, resetFormForNextItem, HUD, toggle button, autostart flag |
| `src/app/vault/VaultInner.tsx` | "Start Haul" shortcut link |
| `src/components/CameraCapturePanel.tsx` | `autoOpen` prop to re-trigger camera after reset |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/lib/haulSession.ts src/components/HaulReviewSheet.tsx src/app/vault/add/page.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] "Haul Mode" button appears in vault add header
- [ ] Tapping it shows the HUD at bottom, replaces post-save navigation with form reset
- [ ] After saving each item, form resets for next item; camera re-opens automatically
- [ ] HUD count increments after each save; value total updates
- [ ] "Done · Review" opens HaulReviewSheet
- [ ] Review sheet lists all saved items with thumbnails, grade, value
- [ ] Low-confidence items show red badge in review
- [ ] "Remove" button deletes from vault + marks skipped
- [ ] "Share your haul" fires `navigator.share` (or clipboard fallback) with haul summary
- [ ] "Done — Go to Vault" clears haul session, navigates to /vault
- [ ] Refreshing the page mid-haul resumes the session
- [ ] "⚡ Haul Mode" shortcut on vault home auto-starts haul on add page

Commit: `feat: haul mode — persistent scan session, live HUD, batch review, share haul`
