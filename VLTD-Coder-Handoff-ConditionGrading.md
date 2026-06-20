# VLTD — Task 1: AI Condition Grading

The API (`/api/ai/analyze-item`) already returns `condition` and `grade` fields, but the prompt is generic and the data is never surfaced prominently. This handoff upgrades the prompt to universe-specific grading, adds a `conditionReason` field to VaultItem, surfaces a ConditionAssessmentPanel on the scan result screen with a manual override, and adds a condition badge on vault cards.

---

## What already exists (don't change)

- `src/app/api/ai/analyze-item/route.ts` — Anthropic vision API, returns `condition`, `grade`, `confidence`
- `src/lib/ai/openaiVision.ts` — client-side fetch wrapper, maps the response
- VaultItem already has `grade?: string` — this is where condition/grade is stored

---

## Step 1 — Add `conditionReason` to VaultItem

**File:** `src/lib/vaultModel.ts`

After `grade?: string`:
```typescript
grade?: string;
conditionReason?: string;   // ← ADD: AI reasoning e.g. "Light corner wear, clean surface"
conditionSource?: "ai" | "manual";  // ← ADD: track whether AI or user set the grade
```

In `normalizeOne()` after `grade:`:
```typescript
conditionReason:
  typeof raw.conditionReason === "string" && raw.conditionReason.trim()
    ? raw.conditionReason.trim()
    : undefined,
conditionSource:
  raw.conditionSource === "ai" || raw.conditionSource === "manual"
    ? raw.conditionSource
    : undefined,
```

---

## Step 2 — Upgrade the AI prompt for universe-specific grading

**File:** `src/app/api/ai/analyze-item/route.ts`

Replace the current flat schema with a richer one that returns a `conditionAssessment` object. The `universe` param is already accepted by the route — use it to inject the right scale.

### 2a — Add grading scale helper

```typescript
function gradingScaleInstructions(universe: string, category: string): string {
  const u = universe.toUpperCase();
  const c = category.toLowerCase();

  if (u === "SPORTS" || u === "TCG") {
    return `Grading scale: PSA/BGS numeric 1–10 (10=Gem Mint, 9=Mint, 8=NM-MT, 7=NM, 6=EX-MT, 5=EX, 4=VG-EX, 3=VG, 2=Good, 1=Poor).
If you see a visible slab label, read the grade directly.
If raw/ungraded, estimate the grade range (e.g. "PSA 7–8") based on visible surface, corners, edges, and centering.`;
  }

  if (u === "POP_CULTURE" || c.includes("comic")) {
    return `Grading scale: CGC/CBCS: 10=Gem Mint, 9.8=Near Mint/Mint, 9.6=NM+, 9.4=NM, 9.2=NM-, 9.0=VF/NM, 8.5=VF+, 8.0=VF, 7.5=VF-, 7.0=F/VF, 6.5=FN+, 6.0=FN, 5.5=FN-, 5.0=VGF, 4.5=VG+, 4.0=VG, 3.5=VG-, 3.0=GD/VG, 2.5=GD+, 2.0=GD, 1.8=GD-, 1.5=FR/GD, 1.0=FR, 0.5=Poor.
Assess spine stress, staple rust, centerfold, water damage, tape, writing.`;
  }

  if (u === "MUSIC") {
    return `Grading scale: Goldmine standard — M (Mint), NM (Near Mint), VG+ (Very Good Plus), VG (Very Good), G+ (Good Plus), G (Good), F (Fair), P (Poor).
Assess sleeve condition separately from record/media condition if both visible.`;
  }

  if (u === "GAMES") {
    return `Grading scale for sealed games: WATA/VGA — A++ (100), A+ (98), A (96), A- (92), B+ (88), B (85), B- (80), etc.
For unsealed: CIB (Complete in Box), Loose (cart/disc only), Manual only.
Note: is the box present? Manual? Inserts? Describe completeness.`;
  }

  if (u === "JEWELRY_APPAREL") {
    return `Describe condition in plain language: Mint/Unworn, Excellent, Very Good, Good, Fair, Poor.
Note: presence of tags, original packaging, visible wear, scratches, tarnish, missing stones or hardware.`;
  }

  return `Describe overall condition as: Mint, Near Mint, Excellent, Very Good, Good, Fair, or Poor.
Note any visible defects — surface scratches, tears, fading, stains, missing parts.`;
}
```

### 2b — Upgrade the schema in the prompt

Replace the flat schema with:
```typescript
const conditionSchema = {
  grade: "string — grading score or named grade, e.g. '9.5', 'NM-MT', 'VG+', 'CIB'",
  condition: "string — named condition tier, e.g. 'Near Mint', 'Very Good', 'Excellent'",
  conditionReason: "string — 1–2 sentences describing what you see, e.g. 'Light corner wear on two corners. Surface is clean with no scratches.'",
  conditionConfidence: "number between 0 and 1 — how confident you are in this assessment",
};

const fullSchema = {
  detectedTitle: "string — full item name",
  confidence: 0.0,
  subtitle: "...",
  number: "...",
  grade: "string — from conditionAssessment",
  certNumber: "...",
  notes: "...",
  year: "...",
  brand: "...",
  condition: "string — from conditionAssessment",
  conditionReason: "string — brief visual reasoning",
  conditionConfidence: 0.0,
  barcode: "...",
};
```

Inject the grading scale into the prompt:
```typescript
const gradingInstructions = gradingScaleInstructions(universe, category);

const prompt = [
  "Analyze this collectible or product photo and return JSON only.",
  universe || category
    ? `Context: Universe: ${universe || "unknown"} / Category: ${category || "unknown"} / Subcategory: ${subcategory || "unknown"}`
    : "",
  gradingInstructions,
  "Use this exact schema:",
  JSON.stringify(fullSchema, null, 2),
  "confidence and conditionConfidence must be between 0 and 1.",
  "Leave fields as empty string if not visible or not applicable.",
  "Return ONLY the JSON object. No explanation, no markdown.",
  hints ? `Extra hints: ${hints}` : "",
].filter(Boolean).join("\n\n");
```

### 2c — Update sanitizeVisionResult and the route response

Add to `VisionRouteResult`:
```typescript
conditionReason?: string;
conditionConfidence?: number;
```

Add to `sanitizeVisionResult()`:
```typescript
conditionReason: typeof raw.conditionReason === "string" ? raw.conditionReason.trim() : undefined,
conditionConfidence:
  typeof raw.conditionConfidence === "number" ? Math.max(0, Math.min(1, raw.conditionConfidence)) : undefined,
```

Add to the `NextResponse.json()` return:
```typescript
conditionReason: parsed.conditionReason ?? "",
conditionConfidence: parsed.conditionConfidence ?? 0,
```

---

## Step 3 — Pass conditionReason through the client-side scan flow

**File:** `src/lib/ai/openaiVision.ts`

Add to `VisionAnalysisResult`:
```typescript
conditionReason: string;
conditionConfidence: number;
```

In `analyzeImageWithVision()`, map the new fields in the return object (same pattern as `grade`, `condition`):
```typescript
conditionReason: String(payload.conditionReason ?? "").trim(),
conditionConfidence: Number(payload.conditionConfidence ?? 0),
```

Then wherever the scan result is applied to a draft VaultItem, map these fields:
- `grade` → `draft.grade`
- `condition` / `conditionReason` → `draft.conditionReason`
- Set `draft.conditionSource = "ai"` so we know it was AI-generated

---

## Step 4 — ConditionAssessmentPanel component

**New file:** `src/components/ConditionAssessmentPanel.tsx`

This panel shows on the scan result / item detail page. It displays the AI grade + reason and lets the collector override.

```tsx
"use client";

import { useState } from "react";
import type { VaultItem } from "@/lib/vaultModel";

const CONDITION_OPTIONS = [
  "Gem Mint / PSA 10",
  "Mint / PSA 9",
  "Near Mint-Mint / PSA 8",
  "Near Mint / PSA 7",
  "Excellent-Mint / PSA 6",
  "Excellent / PSA 5",
  "Very Good-Excellent / PSA 4",
  "Very Good / PSA 3",
  "Good / PSA 2",
  "Poor / PSA 1",
  "Sealed / Factory Sealed",
  "CIB (Complete in Box)",
  "Loose",
  "Near Mint (NM)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good (G+)",
  "Fair",
];

export default function ConditionAssessmentPanel({
  item,
  onUpdate,
}: {
  item: VaultItem;
  onUpdate: (patch: { grade?: string; conditionReason?: string; conditionSource?: "ai" | "manual" }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [gradeInput, setGradeInput] = useState(item.grade ?? "");
  const [reasonInput, setReasonInput] = useState(item.conditionReason ?? "");

  const hasAiGrade = !!item.grade && item.conditionSource === "ai";
  const hasManualGrade = !!item.grade && item.conditionSource === "manual";
  const hasGrade = !!item.grade;

  function handleSave() {
    onUpdate({
      grade: gradeInput.trim() || undefined,
      conditionReason: reasonInput.trim() || undefined,
      conditionSource: "manual",
    });
    setEditing(false);
  }

  return (
    <div
      className="rounded-2xl ring-1 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
            Condition
          </span>
          {hasAiGrade && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              style={{
                background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))",
              }}
            >
              AI assessed
            </span>
          )}
          {hasManualGrade && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              style={{
                background: "var(--pill)",
                color: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              Manual
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="text-[12px] transition-opacity hover:opacity-70"
          style={{ color: "var(--theme-gold, #F5B548)" }}
        >
          {editing ? "Cancel" : hasGrade ? "Edit" : "Set grade"}
        </button>
      </div>

      {/* Display */}
      {!editing && (
        <div className="px-4 py-3">
          {hasGrade ? (
            <>
              <div className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
                {item.grade}
              </div>
              {item.conditionReason && (
                <div className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                  {item.conditionReason}
                </div>
              )}
            </>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--muted2)" }}>
              No grade recorded. Tap "Set grade" to add one.
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>
              GRADE / CONDITION
            </label>
            <input
              type="text"
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="e.g. PSA 9, NM, Near Mint, Sealed…"
              list="condition-options"
              className="w-full rounded-xl px-3 py-2 text-[14px] ring-1 outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            />
            <datalist id="condition-options">
              {CONDITION_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>
              NOTES (optional)
            </label>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Light corner wear on two corners. Surface clean."
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-[13px] ring-1 outline-none resize-none"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-full py-2.5 text-[13px] font-bold"
            style={{ background: "var(--theme-gold, #F5B548)", color: "#0A0800" }}
          >
            Save Grade
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Step 5 — Wire ConditionAssessmentPanel into item detail

**File:** `src/app/vault/item/[id]/page.tsx`

Import and add after the basic item info block, before the Net Proceeds section:

```tsx
import ConditionAssessmentPanel from "@/components/ConditionAssessmentPanel";
```

```tsx
<ConditionAssessmentPanel
  item={item}
  onUpdate={(patch) => {
    const updated = { ...item, ...patch };
    saveItem(updated);
    setItem(updated);
  }}
/>
```

---

## Step 6 — Condition badge on vault cards

**File:** `src/app/vault/VaultInner.tsx` (inline VaultCard)

In the subtitle/metadata line of each card, show the grade if present:

```tsx
{i.grade && (
  <span
    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1"
    style={{
      background: "rgba(10,8,0,0.75)",
      color: "var(--theme-gold, #F5B548)",
      borderColor: "rgba(245,181,72,0.4)",
    }}
  >
    {i.grade.length > 10 ? i.grade.slice(0, 10) : i.grade}
  </span>
)}
```

---

## Step 7 — Condition filter in vault search

**File:** `src/app/vault/VaultInner.tsx`

Add a `gradeFilter` state. When active, filter items where `grade` contains the search string (case-insensitive). Surface it as a text search field in the filter section or as quick-filter chips:

```typescript
const [gradeFilter, setGradeFilter] = useState("");
```

```typescript
.filter((item) => {
  if (!gradeFilter.trim()) return true;
  return (item.grade ?? "").toLowerCase().includes(gradeFilter.toLowerCase());
})
```

Quick-filter chips (optional, for the most common grades):
```tsx
{["PSA 10", "PSA 9", "NM", "Sealed"].map((g) => (
  <button
    key={g}
    type="button"
    onClick={() => setGradeFilter(gradeFilter === g ? "" : g)}
    className="rounded-full px-2.5 py-1 text-[11px] ring-1 transition"
    style={gradeFilter === g ? {
      background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
      color: "var(--theme-gold, #F5B548)",
      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
    } : {
      background: "var(--surface)",
      color: "var(--muted)",
      borderColor: "var(--border)",
    }}
  >
    {g}
  </button>
))}
```

---

## Step 8 — CSV export update

**File:** `src/lib/vaultExport.ts`

Add `conditionReason` and `conditionSource` to the CSV columns alongside `grade`.

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/app/api/ai/analyze-item/route.ts src/components/ConditionAssessmentPanel.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Scan a graded card — `grade` and `conditionReason` return from the AI API
- [ ] Scan a raw card — AI returns an estimated grade range + reasoning
- [ ] Scan a vinyl record — AI uses Goldmine scale (NM, VG+, etc.)
- [ ] Scan a comic — AI uses CGC-style numeric grade
- [ ] ConditionAssessmentPanel shows AI grade + reason on item detail
- [ ] "AI assessed" badge shown when `conditionSource === "ai"`
- [ ] Editing and saving grade sets `conditionSource === "manual"`
- [ ] Grade badge appears on vault cards when `grade` is set
- [ ] Grade filter narrows vault items correctly

Commit: `feat: ai condition grading — universe-specific scales, condition panel, card badge, vault filter`

---

## Files changed summary

| File | Change |
|------|--------|
| `src/lib/vaultModel.ts` | Add `conditionReason?: string`, `conditionSource?: "ai" \| "manual"` |
| `src/app/api/ai/analyze-item/route.ts` | Add `gradingScaleInstructions()`, upgrade prompt schema, return `conditionReason` + `conditionConfidence` |
| `src/lib/ai/openaiVision.ts` | Add `conditionReason`, `conditionConfidence` to VisionAnalysisResult + mapping |
| `src/components/ConditionAssessmentPanel.tsx` | **NEW** — grade display + manual override form |
| `src/app/vault/item/[id]/page.tsx` | Wire ConditionAssessmentPanel; map `conditionReason` + `conditionSource` from scan result |
| `src/app/vault/VaultInner.tsx` | Grade badge on cards; `gradeFilter` state + quick-filter chips |
| `src/lib/vaultExport.ts` | Add `conditionReason`, `conditionSource` to CSV |
