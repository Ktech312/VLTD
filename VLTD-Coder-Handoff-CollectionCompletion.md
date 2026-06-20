# VLTD — Collection Completion %

The single most powerful daily-return mechanic in any collector app. A completion % creates a goal; a goal creates return visits. Collectors will come back obsessively to close the gap.

Phase 1 is **self-reported targets** — the collector defines what they're building toward ("I want all 102 Pokémon Base Set cards"). No external catalog needed. Phase 2 (post-launch) can add a pre-built set catalog. This lets us ship immediately with no dependencies.

---

## How it works

A **Collection Goal** is a named target the user sets:

```
Goal name:     "Pokémon Base Set"
Target count:  102
Universe:      TCG
Subject:       Pikachu (optional — link to Registry subject)
```

VLTD counts how many vault items the user has that match this goal (by subject tag, or manually), divides by the target, and shows a progress bar. Missing count = target − owned. Those missing items can be pushed to the Want List in one tap.

---

## Data model

### New type — Collection Goal

**New file:** `src/lib/collectionGoals.ts`

```typescript
export type CollectionGoal = {
  id: string;
  name: string;          // "Pokémon Base Set", "All Shohei Ohtani Rookies", etc.
  targetCount: number;   // how many items make a complete collection
  universe?: string;     // optional — filter vault to this universe when counting
  subject?: string;      // optional — links to Vault Registry subject tag
  notes?: string;
  createdAt: number;
};

export type GoalProgress = CollectionGoal & {
  ownedCount: number;    // how many vault items match this goal
  pct: number;           // ownedCount / targetCount * 100, clamped 0–100
  missing: number;       // targetCount - ownedCount (min 0)
  isComplete: boolean;
  isAlmostThere: boolean; // pct >= 90
};

const STORAGE_KEY = "vltd_collection_goals_v1";

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadGoals(): CollectionGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveGoals(goals: CollectionGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function addGoal(
  fields: Omit<CollectionGoal, "id" | "createdAt">
): CollectionGoal {
  const goal: CollectionGoal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...fields,
  };
  const existing = loadGoals();
  saveGoals([...existing, goal]);
  return goal;
}

export function updateGoal(id: string, patch: Partial<Omit<CollectionGoal, "id" | "createdAt">>) {
  const goals = loadGoals();
  const next = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
  saveGoals(next);
}

export function deleteGoal(id: string) {
  saveGoals(loadGoals().filter((g) => g.id !== id));
}

// ── Progress computation ──────────────────────────────────────────────────────

/**
 * Given a goal and the user's vault items, compute how many items count toward it.
 *
 * Matching logic (in priority order):
 * 1. If goal has a subject: count vault items where item.subject (case-insensitive) === goal.subject
 * 2. If goal has a universe only: count vault items in that universe
 * 3. Fallback: count all active vault items (not SOLD/WISHLIST)
 *
 * The user can also manually increment ownedCount via the goal edit screen (future).
 */
export function computeGoalProgress(
  goal: CollectionGoal,
  vaultItems: import("@/lib/vaultModel").VaultItem[]
): GoalProgress {
  const active = vaultItems.filter(
    (i) => i.status !== "SOLD" && i.status !== "WISHLIST"
  );

  let ownedCount: number;

  if (goal.subject?.trim()) {
    const key = goal.subject.trim().toLowerCase();
    ownedCount = active.filter(
      (i) => (i.subject ?? "").toLowerCase() === key
    ).length;
  } else if (goal.universe) {
    ownedCount = active.filter((i) => i.universe === goal.universe).length;
  } else {
    ownedCount = active.length;
  }

  const pct = Math.min(100, Math.round((ownedCount / Math.max(1, goal.targetCount)) * 100));
  const missing = Math.max(0, goal.targetCount - ownedCount);

  return {
    ...goal,
    ownedCount,
    pct,
    missing,
    isComplete: ownedCount >= goal.targetCount,
    isAlmostThere: pct >= 90 && !missing === false,
  };
}

export function computeAllGoalProgress(
  goals: CollectionGoal[],
  vaultItems: import("@/lib/vaultModel").VaultItem[]
): GoalProgress[] {
  return goals
    .map((g) => computeGoalProgress(g, vaultItems))
    .sort((a, b) => b.pct - a.pct); // closest to complete first
}
```

---

## Step 1 — Goals page (new route)

**New file:** `src/app/goals/page.tsx`

This is the main goals management screen. Render a list of GoalProgress cards with an "Add Goal" button at the top.

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  loadGoals, addGoal, deleteGoal,
  computeAllGoalProgress, type GoalProgress
} from "@/lib/collectionGoals";
import { loadItems } from "@/lib/vaultModel";
import { addWishlistItem } from "@/lib/wishlistModel";
import GoalCard from "@/components/GoalCard";
import AddGoalSheet from "@/components/AddGoalSheet";

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState(loadGoals);
  const [items, setItems] = useState(() => loadItems());
  const [showAdd, setShowAdd] = useState(false);

  // Reload on focus (items may have changed in vault tab)
  useEffect(() => {
    const onFocus = () => {
      setGoals(loadGoals());
      setItems(loadItems());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const progress = useMemo(() => computeAllGoalProgress(goals, items), [goals, items]);

  function handleAddToWishlist(goal: GoalProgress) {
    // Push "missing items" as a single wishlist entry
    if (goal.missing <= 0) return;
    addWishlistItem({
      title: `${goal.name} — ${goal.missing} missing pieces`,
      notes: `${goal.ownedCount} of ${goal.targetCount} owned (${goal.pct}% complete)`,
      universe: goal.universe,
      subject: goal.subject,
      priority: goal.isAlmostThere ? "high" : "medium",
    });
    // Optional: toast
  }

  function handleDelete(id: string) {
    deleteGoal(id);
    setGoals(loadGoals());
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--fg)" }}>
          Collection Goals
        </h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-full px-4 py-2 text-[13px] font-semibold ring-1 transition"
          style={{
            background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
            color: "var(--theme-gold, #F5B548)",
            borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
          }}
        >
          + Add Goal
        </button>
      </div>

      {progress.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center ring-1"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-[15px] font-semibold mb-2" style={{ color: "var(--fg)" }}>
            No goals yet
          </div>
          <div className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
            Create a goal to track how close you are to completing a set or building a collection.
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-full px-5 py-2 text-[13px] font-semibold ring-1"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
            }}
          >
            + Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onAddToWishlist={() => handleAddToWishlist(g)}
              onDelete={() => handleDelete(g.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddGoalSheet
          onClose={() => setShowAdd(false)}
          onSave={(fields) => {
            addGoal(fields);
            setGoals(loadGoals());
            setShowAdd(false);
          }}
        />
      )}
    </main>
  );
}
```

---

## Step 2 — GoalCard component

**New file:** `src/components/GoalCard.tsx`

```tsx
"use client";

import type { GoalProgress } from "@/lib/collectionGoals";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export default function GoalCard({
  goal,
  onAddToWishlist,
  onDelete,
}: {
  goal: GoalProgress;
  onAddToWishlist: () => void;
  onDelete: () => void;
}) {
  const universeLabel = goal.universe
    ? UNIVERSE_LABEL[goal.universe as UniverseKey] ?? goal.universe
    : null;

  return (
    <div
      className="rounded-2xl ring-1 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {universeLabel && (
                <span
                  className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                  style={{ color: "var(--muted2)" }}
                >
                  {universeLabel}
                </span>
              )}
              {goal.isAlmostThere && !goal.isComplete && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                  style={{
                    background: "rgba(74,222,128,0.12)",
                    color: "#4ade80",
                    borderColor: "rgba(74,222,128,0.35)",
                  }}
                >
                  Almost there!
                </span>
              )}
              {goal.isComplete && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                  style={{
                    background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
                    color: "var(--theme-gold, #F5B548)",
                    borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
                  }}
                >
                  ✦ Complete
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[16px] font-bold truncate" style={{ color: "var(--fg)" }}>
              {goal.name}
            </div>
            {goal.subject && (
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                Subject: {goal.subject}
              </div>
            )}
          </div>

          {/* Pct badge */}
          <div
            className="flex-shrink-0 rounded-xl px-3 py-1.5 text-center ring-1"
            style={{
              background: goal.isComplete
                ? "var(--theme-gold-subtle, rgba(245,181,72,0.12))"
                : "var(--pill)",
              borderColor: goal.isComplete
                ? "var(--theme-gold-border, rgba(245,181,72,0.35))"
                : "var(--border)",
            }}
          >
            <div
              className="text-[20px] font-black leading-none"
              style={{ color: goal.isComplete ? "var(--theme-gold, #F5B548)" : "var(--fg)" }}
            >
              {goal.pct}%
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--muted2)" }}>
              complete
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "var(--pill)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${goal.pct}%`,
                background: goal.isComplete
                  ? "var(--theme-gold, #F5B548)"
                  : goal.isAlmostThere
                  ? "linear-gradient(90deg, #4ade80, #86efac)"
                  : "linear-gradient(90deg, var(--theme-gold, #F5B548), rgba(245,181,72,0.6))",
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {goal.ownedCount} of {goal.targetCount} items
            </span>
            {goal.missing > 0 && (
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                {goal.missing} to go
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {goal.missing > 0 && (
          <button
            type="button"
            onClick={onAddToWishlist}
            className="flex-1 rounded-full py-2 text-[12px] font-semibold ring-1 transition"
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              borderColor: "var(--border)",
            }}
          >
            + Add {goal.missing} to Want List
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full px-3 py-2 text-[12px] ring-1 transition"
          style={{
            background: "var(--surface)",
            color: "var(--muted2)",
            borderColor: "var(--border)",
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
```

---

## Step 3 — AddGoalSheet (bottom sheet / modal)

**New file:** `src/components/AddGoalSheet.tsx`

```tsx
"use client";

import { useState } from "react";
import type { CollectionGoal } from "@/lib/collectionGoals";
import { UNIVERSE_LABEL, UNIVERSE_KEYS } from "@/lib/taxonomy";

type GoalFields = Omit<CollectionGoal, "id" | "createdAt">;

export default function AddGoalSheet({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (fields: GoalFields) => void;
  initial?: Partial<GoalFields>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetCount, setTargetCount] = useState(String(initial?.targetCount ?? ""));
  const [universe, setUniverse] = useState(initial?.universe ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const canSave = name.trim() && Number(targetCount) > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      targetCount: Math.max(1, Math.round(Number(targetCount))),
      universe: universe || undefined,
      subject: subject.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] px-5 pb-10 pt-6 max-w-xl mx-auto"
        style={{ background: "var(--surface)", boxShadow: "0 -4px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
            New Collection Goal
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[20px] leading-none"
            style={{ color: "var(--muted2)" }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
              GOAL NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pokémon Base Set, All Ohtani Rookies"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            />
          </div>

          {/* Target count */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
              TOTAL ITEMS IN COMPLETE SET *
            </label>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              placeholder="e.g. 102"
              min={1}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            />
          </div>

          {/* Universe */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
              CATEGORY (optional)
            </label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 outline-none"
              style={{ background: "var(--pill)", color: universe ? "var(--fg)" : "var(--muted)", borderColor: "var(--border)" }}
            >
              <option value="">All categories</option>
              {UNIVERSE_KEYS.map((k) => (
                <option key={k} value={k}>{UNIVERSE_LABEL[k]}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
              SUBJECT TAG (optional — links to Vault Registry)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Pikachu, Shohei Ohtani"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            />
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
              Match your item Subject tags to auto-count progress
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="mt-6 w-full rounded-full py-3.5 text-[14px] font-bold transition"
          style={{
            background: canSave
              ? "var(--theme-gold, #F5B548)"
              : "var(--pill)",
            color: canSave ? "#0A0800" : "var(--muted2)",
          }}
        >
          Save Goal
        </button>
      </div>
    </>
  );
}
```

---

## Step 4 — Dashboard widget (most-complete goals)

**New file:** `src/components/GoalsProgressWidget.tsx`

A compact widget for the vault dashboard or portfolio page showing the top 3 goals closest to completion.

```tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { computeAllGoalProgress, type CollectionGoal } from "@/lib/collectionGoals";
import type { VaultItem } from "@/lib/vaultModel";

export default function GoalsProgressWidget({
  goals,
  items,
}: {
  goals: CollectionGoal[];
  items: VaultItem[];
}) {
  const router = useRouter();
  const progress = useMemo(
    () => computeAllGoalProgress(goals, items).slice(0, 3),
    [goals, items]
  );

  if (progress.length === 0) return null;

  return (
    <div
      className="rounded-2xl ring-1 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
          Collection Goals
        </span>
        <button
          type="button"
          onClick={() => router.push("/goals")}
          className="text-[12px] transition-opacity hover:opacity-70"
          style={{ color: "var(--theme-gold, #F5B548)" }}
        >
          See all →
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {progress.map((g) => (
          <div key={g.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[13px] font-semibold truncate"
                style={{ color: "var(--fg)" }}
              >
                {g.name}
              </span>
              <span
                className="ml-2 flex-shrink-0 text-[12px] font-bold"
                style={{ color: g.isComplete ? "var(--theme-gold, #F5B548)" : "var(--muted)" }}
              >
                {g.pct}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--pill)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${g.pct}%`,
                  background: g.isComplete
                    ? "var(--theme-gold, #F5B548)"
                    : g.isAlmostThere
                    ? "#4ade80"
                    : "rgba(245,181,72,0.6)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
              {g.ownedCount} / {g.targetCount}
              {g.isAlmostThere && !g.isComplete && (
                <span style={{ color: "#4ade80" }}> · Almost there!</span>
              )}
              {g.isComplete && (
                <span style={{ color: "var(--theme-gold, #F5B548)" }}> · ✦ Complete!</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 5 — Add Goals to nav

Add `/goals` to your app's tab bar / nav wherever /vault, /wishlist, /portfolio live. Icon suggestion: a checkmark circle or target `◎`.

```tsx
{ href: "/goals", label: "Goals", icon: "◎" }
```

---

## Step 6 — Wire widgets into portfolio page

**File:** `src/app/portfolio/PortfolioClient.tsx`

```typescript
import { loadGoals } from "@/lib/collectionGoals";
import GoalsProgressWidget from "@/components/GoalsProgressWidget";
```

```tsx
// In the component:
const [goals, setGoals] = useState(loadGoals);

// In the JSX alongside other panels:
<GoalsProgressWidget goals={goals} items={items} />
```

---

## Taxonomy note

`AddGoalSheet` imports `UNIVERSE_KEYS` — add this export to `src/lib/taxonomy.ts` if it doesn't exist:

```typescript
export const UNIVERSE_KEYS = Object.keys(UNIVERSE_LABEL) as UniverseKey[];
```

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/lib/collectionGoals.ts src/components/GoalCard.tsx src/components/AddGoalSheet.tsx src/components/GoalsProgressWidget.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Can create a goal with name + target count
- [ ] Goal with subject tag counts only items where item.subject matches
- [ ] Goal with universe only counts items in that universe
- [ ] Progress % and bar update immediately after adding items to vault
- [ ] "Almost there!" badge shows at ≥90%
- [ ] "Complete" badge shows when ownedCount ≥ targetCount
- [ ] "Add X to Want List" creates a wishlist item with correct title + subject
- [ ] Can delete a goal
- [ ] GoalsProgressWidget on portfolio page shows top 3 sorted by pct desc
- [ ] "See all →" navigates to /goals

Commit: `feat: collection goals — completion tracking with want list integration`

---

## Files summary

| File | Change |
|------|--------|
| `src/lib/collectionGoals.ts` | **NEW** — CollectionGoal type, CRUD, computeGoalProgress() |
| `src/lib/taxonomy.ts` | Add `UNIVERSE_KEYS` export if missing |
| `src/components/GoalCard.tsx` | **NEW** — progress card with bar, badge, actions |
| `src/components/AddGoalSheet.tsx` | **NEW** — bottom sheet form for creating a goal |
| `src/components/GoalsProgressWidget.tsx` | **NEW** — compact dashboard widget (top 3) |
| `src/app/goals/page.tsx` | **NEW** — /goals route, full goals management screen |
| `src/app/portfolio/PortfolioClient.tsx` | Wire in GoalsProgressWidget |
| App nav | Add Goals link/tab |
