# VLTD — Scanning Flow UI Fixes

**Files changed:** 2 (`src/components/ScanPanel.tsx`, `src/components/CameraCapturePanel.tsx`)

Three targeted fixes across the scanning flow: the Fast Entry capture section layout, the camera modal button layout, and the Adjust Photo screen (frame selector + Capture Studio clutter).

---

## Fix 1 — ScanPanel.tsx: CAPTURE AND IDENTIFY layout

### Problem
The 3-column grid only activates at `lg:` (1024px). Below that the three sections stack as full-width blocks and look disconnected. At lg the right column is a fixed 168px which is too narrow for labels like "Auto Identify with AI" and "More Identify Options". The Camera button in the right column is also visually redundant with the "Take New Picture" center button.

### What to change

**Line 118** — change the grid column template:

```tsx
// Before
<div className="mt-3 grid gap-2 lg:grid-cols-[108px_minmax(0,1fr)_168px]">

// After
<div className="mt-3 grid gap-2 md:grid-cols-[96px_minmax(0,1fr)_188px]">
```

**Lines 193–245** — right column: rename "Camera" → "Open Camera", remove the redundant standalone Camera pill (Camera + File is fine, just rename for clarity), and let "Auto Identify with AI" breathe at the wider column:

```tsx
// Before (line 194–201)
<div className="grid grid-cols-2 gap-2">
  <button type="button" onClick={onUseCamera} className={actionButtonClass(true)}>
    Camera
  </button>
  <button type="button" onClick={onUploadImage} className={actionButtonClass()}>
    File
  </button>
</div>

// After
<div className="grid grid-cols-2 gap-1.5">
  <button type="button" onClick={onUseCamera} className={actionButtonClass(true)}>
    Camera
  </button>
  <button type="button" onClick={onUploadImage} className={actionButtonClass()}>
    File
  </button>
</div>
```

No other changes to this column — the wider `188px` column gives "Auto Identify with AI" and "More Identify Options" enough room without wrapping.

---

## Fix 2 — CameraCapturePanel.tsx: Live Camera bottom button layout

### Problem
The primary "Capture Photo" button shares the same height and weight as "Retry Camera" and "Choose File Instead" — visually they're equals when they shouldn't be. The Cancel button is a separate row below. The camera device selector floats awkwardly above the button row.

### What to change

**Lines 744–777** — replace the entire button section at the bottom of the live camera view:

```tsx
// Before
<div className="mt-2 grid gap-2 sm:grid-cols-3">
  <button
    type="button"
    onClick={() => void handleCapture()}
    disabled={Boolean(cameraError) || isStarting || isCapturing}
    className="min-h-10 rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
  >
    {isStarting ? "Starting Camera..." : isCapturing ? "Capturing..." : "Capture Photo"}
  </button>
  <button
    type="button"
    onClick={() => setRetryCount((count) => count + 1)}
    className="min-h-10 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
  >
    Retry Camera
  </button>
  <button
    type="button"
    onClick={onUseFileInstead}
    className="min-h-10 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
  >
    Choose File Instead
  </button>
</div>

<div className="mt-2 grid gap-2 sm:grid-cols-1">
  <button
    type="button"
    onClick={onClose}
    className="min-h-10 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
  >
    Cancel
  </button>
</div>
```

Replace with:

```tsx
{/* Primary capture action */}
<button
  type="button"
  onClick={() => void handleCapture()}
  disabled={Boolean(cameraError) || isStarting || isCapturing}
  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-40"
  style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}
>
  {isStarting ? (
    "Starting camera…"
  ) : isCapturing ? (
    "Capturing…"
  ) : (
    <>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      Capture Photo
    </>
  )}
</button>

{/* Secondary actions */}
<div className="mt-1.5 grid grid-cols-2 gap-1.5">
  <button
    type="button"
    onClick={() => setRetryCount((count) => count + 1)}
    className="min-h-9 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
  >
    Retry Camera
  </button>
  <button
    type="button"
    onClick={onUseFileInstead}
    className="min-h-9 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
  >
    Choose File
  </button>
</div>
```

**Delete the separate Cancel row** (lines 769–777 in original) — the `Close` button in the modal header already handles this.

---

## Fix 3 — CameraCapturePanel.tsx: Adjust Photo — frame selector + Capture Studio

Two sub-fixes in the same screen:

### 3a — Add a frame type selector above the blur warning

Currently the camera viewfinder frame shape is inferred from the `universe` prop and can't be changed mid-session. The user wants to be able to pick Card / Book / Jewelry / Art (compact pills) right at the top of the Adjust Photo view.

**At the top of the component** (after existing state declarations, around line 63), add:

```tsx
const FRAME_OPTIONS = [
  { key: "card",    label: "Card",    aspectRatio: "2.5 / 3.5", inset: "10%", radius: "14px" },
  { key: "book",    label: "Book",    aspectRatio: "2 / 3",     inset: "7%",  radius: "16px" },
  { key: "jewelry", label: "Jewelry", aspectRatio: "1 / 1",     inset: "12%", radius: "999px" },
  { key: "art",     label: "Art",     aspectRatio: "4 / 3",     inset: "9%",  radius: "16px" },
] as const;
type LocalFrameKey = typeof FRAME_OPTIONS[number]["key"];

// inside the component, after the existing useState declarations:
const [localFrame, setLocalFrame] = useState<LocalFrameKey>("card");
const activeLocalFrame = FRAME_OPTIONS.find((f) => f.key === localFrame) ?? FRAME_OPTIONS[0];
```

**Update the camera viewfinder overlay** (lines 681–700) to use `activeLocalFrame` instead of `frame`:

```tsx
// Before
<div
  className="pointer-events-none absolute left-1/2 top-1/2 flex max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 items-start justify-center ring-2 ring-[color:var(--theme-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
  style={{
    aspectRatio: frame.aspectRatio,
    borderRadius: frame.radius,
    height: `calc(100% - ${frame.inset})`,
    width: "auto",
  }}
>
  <div
    className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1"
    style={{
      background: "rgba(0,0,0,0.48)",
      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
      color: "var(--theme-gold, #F5B548)",
    }}
  >
    {universeLabel} · {frame.label}
  </div>
</div>
```

```tsx
// After
<div
  className="pointer-events-none absolute left-1/2 top-1/2 flex max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 items-start justify-center ring-2 ring-[color:var(--theme-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
  style={{
    aspectRatio: activeLocalFrame.aspectRatio,
    borderRadius: activeLocalFrame.radius,
    height: `calc(100% - ${activeLocalFrame.inset})`,
    width: "auto",
  }}
>
  <div
    className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1"
    style={{
      background: "rgba(0,0,0,0.48)",
      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
      color: "var(--theme-gold, #F5B548)",
    }}
  >
    {universeLabel} · {activeLocalFrame.label}
  </div>
</div>
```

**In the Adjust Photo view** (line 479, inside the `capturedFile && capturedPreviewUrl` branch), add the frame pills row **above** the blur warning:

```tsx
// Replace the start of the adjust photo view (line 480-490 area):
// Before:
<div className="mt-2">
  {blurAssessment?.isBlurry ? (
    <div className="mb-2 rounded-2xl bg-[color:var(--pill)] px-3 py-2 text-xs ring-1 ring-[color:var(--theme-gold-border,rgba(245,181,72,0.32))]">
      <div className="font-semibold text-[color:var(--theme-gold,#F5B548)]">
        Soft focus detected
      </div>
      <div className="mt-0.5 text-[color:var(--muted)]">
        Retake if this is for identification or insurance. Score: {blurAssessment.score.toFixed(1)}.
      </div>
    </div>
  ) : null}
```

```tsx
// After:
<div className="mt-2">
  {/* Frame type picker */}
  <div className="mb-2 flex items-center gap-1.5">
    <span className="text-[10px] tracking-[0.14em] text-[color:var(--muted2)]">FRAME</span>
    <div className="flex gap-1 overflow-x-auto">
      {FRAME_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setLocalFrame(opt.key)}
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition"
          style={
            localFrame === opt.key
              ? {
                  background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))",
                  color: "var(--theme-gold, #F5B548)",
                }
              : {
                  background: "var(--pill)",
                  borderColor: "var(--border)",
                  color: "var(--muted)",
                }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>

  {blurAssessment?.isBlurry ? (
    <div className="mb-2 rounded-2xl bg-[color:var(--pill)] px-3 py-2 text-xs ring-1 ring-[color:var(--theme-gold-border,rgba(245,181,72,0.32))]">
      <div className="font-semibold text-[color:var(--theme-gold,#F5B548)]">
        Soft focus detected
      </div>
      <div className="mt-0.5 text-[color:var(--muted)]">
        Retake if this is for identification or insurance. Score: {blurAssessment.score.toFixed(1)}.
      </div>
    </div>
  ) : null}
```

---

### 3b — Collapse sliders behind "Fine Tune" toggle in Capture Studio

The 5 sliders (Brightness, Contrast, Saturation, Warmth, Sharpness) are always visible, making Capture Studio feel heavy. Hide them by default behind a toggle.

**Add state** near the other state declarations:

```tsx
const [showFineTune, setShowFineTune] = useState(false);
```

**Find the sliders grid** (lines 556–588) and wrap it:

```tsx
// Before (line 556):
<div className="mt-2 grid gap-1.5 sm:grid-cols-3">
  {[
    { key: "brightness", label: "Brightness", min: 70, max: 130 },
    { key: "contrast",   label: "Contrast",   min: 70, max: 140 },
    { key: "saturation", label: "Saturation", min: 60, max: 150 },
    { key: "warmth",     label: "Warmth",     min: -40, max: 40 },
    { key: "sharpness",  label: "Sharpness",  min: 0,  max: 30  },
  ].map((control) => (
    ... slider jsx ...
  ))}
</div>
```

```tsx
// After — add the toggle button before the slider grid, then gate the grid:
<button
  type="button"
  onClick={() => setShowFineTune((prev) => !prev)}
  className="mt-2 flex items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-3 py-1 text-[11px] ring-1 ring-[color:var(--border)]"
  style={{ color: "var(--muted)" }}
>
  Fine Tune
  <svg
    width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
    style={{ transform: showFineTune ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 160ms" }}
  >
    <path d="M6 9l6 6 6-6"/>
  </svg>
</button>

{showFineTune && (
  <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
    {[
      { key: "brightness", label: "Brightness", min: 70, max: 130 },
      { key: "contrast",   label: "Contrast",   min: 70, max: 140 },
      { key: "saturation", label: "Saturation", min: 60, max: 150 },
      { key: "warmth",     label: "Warmth",     min: -40, max: 40 },
      { key: "sharpness",  label: "Sharpness",  min: 0,  max: 30  },
    ].map((control) => (
      <label key={control.key} className="rounded-xl bg-[color:var(--pill)] px-2.5 py-1.5 ring-1 ring-[color:var(--border)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
            {control.label}
          </span>
          <span className="text-[11px] font-semibold text-[color:var(--fg)]">
            {adjustments[control.key as keyof CaptureAdjustments]}
          </span>
        </div>
        <input
          type="range"
          min={control.min}
          max={control.max}
          value={adjustments[control.key as keyof CaptureAdjustments]}
          onChange={(event) =>
            updateAdjustment(
              control.key as keyof CaptureAdjustments,
              Number(event.target.value)
            )
          }
          className="mt-1 w-full accent-[color:var(--theme-gold)]"
        />
      </label>
    ))}
  </div>
)}
```

---

## Fix 4 — CameraCapturePanel.tsx: Modal too tall, no internal scroll

### Problem
Both the Live Camera and Adjust Photo views spill below the viewport. The outer backdrop has `overflow-y-auto` but that means the user has to scroll the dark background — not the modal card. The crop editor's touch handlers intercept scroll events entirely, making the Adjust Photo screen unreachable below the crop area on touch devices.

### What to change

**Line 459 — the outer backdrop div:**

```tsx
// Before
<div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/75 p-2 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true" aria-label={title}>

// After
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-3" role="dialog" aria-modal="true" aria-label={title}>
```

**Line 460 — the inner modal card div:**

```tsx
// Before
<div className="mx-auto flex max-w-2xl flex-col rounded-[18px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">

// After
<div
  className="mx-auto flex w-full max-w-2xl flex-col overflow-y-auto overscroll-contain rounded-t-[22px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[18px]"
  style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px))" }}
>
```

**What this does:**
- Backdrop becomes a flex centering container (no scroll on the dark overlay)
- On mobile: modal slides up from the bottom with rounded top corners (bottom-sheet feel)
- On sm+: modal is centered, rounded all sides, capped at `100dvh - 2rem`
- The modal card itself scrolls internally via `overflow-y-auto` — the header, blur warning, crop editor, Capture Studio all scroll as one unit within the card
- `overscroll-contain` prevents the page behind from scrolling when the modal reaches its scroll limit

**Line 662 — also shrink the live camera viewfinder height:**

```tsx
// Before
<div className="relative flex h-[min(42dvh,360px)] min-h-[210px] items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]">

// After
<div className="relative flex h-[min(36dvh,300px)] min-h-[180px] items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]">
```

Dropping the viewfinder from 42dvh to 36dvh gives the bottom action buttons (Capture Photo, Retry, Choose File) room to appear on screen without scrolling on typical phone heights (812px+).

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Fast Entry — CAPTURE AND IDENTIFY shows 3 columns starting at **md** (768px) breakpoint, not just lg
- [ ] Fast Entry — right column is wide enough that "Auto Identify with AI" and "More Identify Options" don't wrap
- [ ] Camera modal — "Capture Photo" is the prominent gold full-width button at the bottom
- [ ] Camera modal — "Retry Camera" and "Choose File" are a 2-col row below it
- [ ] Camera modal — no separate Cancel row below the buttons (Close in header handles it)
- [ ] Camera modal (Live) — "Capture Photo" button is visible without scrolling on a 812px tall screen
- [ ] Camera modal — scrolling the card works smoothly; the dark backdrop does NOT scroll
- [ ] Adjust Photo — 4 compact frame pills (Card / Book / Jewelry / Art) appear above the blur warning
- [ ] Adjust Photo — clicking a frame pill updates the viewfinder overlay in the live camera view on next retake
- [ ] Adjust Photo — Capture Studio is reachable by scrolling the modal card (not the backdrop)
- [ ] Adjust Photo — Capture Studio shows filter presets immediately, sliders hidden behind "Fine Tune" toggle
- [ ] Clicking "Fine Tune" reveals the 5 sliders; clicking again collapses them
- [ ] "Reset" button in Capture Studio still resets both filter and adjustments regardless of Fine Tune state
- [ ] On sm+ screens: modal is centered, max-height respected, rounded on all sides
- [ ] On mobile: modal appears from the bottom with rounded top corners only
- [ ] TypeScript passes with no new errors

Commit: `fix: scanning flow UI — md breakpoint for capture grid, prominent capture button, frame picker in adjust view, collapse fine-tune sliders, modal height + internal scroll`
