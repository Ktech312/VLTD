# VLTD — Camera Panel Not Opening (Portal Fix)

**File:** `src/app/vault/add/page.tsx`
**Priority:** Ship immediately — camera buttons silently do nothing for users

One change, ~12 lines replaced.

---

## Root Cause

The `CameraCapturePanel` renders inline inside the page's component tree. The crop editor (which works correctly) uses `createPortal` to render at the `document.body` level at z-[120]. The camera panel has no portal and renders at z-[80] inside the page. Some stacking context in the ancestor chain (TopNav has `backdrop-blur-xl` and `z-40`; the Fast Entry sticky header has `backdrop-blur` and `z-20`) suppresses it — the panel either fails to appear above other layers or crashes silently on mount.

The fix is to mirror exactly what the crop editor already does: wrap `CameraCapturePanel` in `createPortal` so it renders at `document.body` with a guaranteed z-[120] stacking context.

---

## The Fix — `src/app/vault/add/page.tsx`

**Step 1 — `createPortal` is already imported at the top of the file.**
Check that this import exists (it should; it's already used for the crop editor):

```tsx
import { createPortal } from "react-dom";
```

If it's already there, no import change needed.

---

**Step 2 — Find and replace the inline camera panel block.**

Find this block (near the bottom of the JSX return, around line 2061):

```tsx
        {isCameraPanelOpen ? (
          <CameraCapturePanel
            key={cameraPanelKey}
            title={cameraTarget === "scan" ? "Capture Item Picture" : "Capture Item Photo"}
            description={
              cameraTarget === "scan"
                ? "Take an item picture. It will be added to this item and used for identify/autofill."
                : "Capture a real item photo and add it to this item's saved photo list."
            }
            universe={values.universe}
            onCapture={handleCapturedPhoto}
            onClose={() => setIsCameraPanelOpen(false)}
            onUseFileInstead={() => {
              setIsCameraPanelOpen(false);
              if (cameraTarget === "scan") {
                uploadInputRef.current?.click();
                return;
              }
              mediaInputRef.current?.click();
            }}
          />
        ) : null}
```

Replace with:

```tsx
        {mounted && isCameraPanelOpen && typeof document !== "undefined"
          ? createPortal(
              <CameraCapturePanel
                key={cameraPanelKey}
                title={cameraTarget === "scan" ? "Capture Item Picture" : "Capture Item Photo"}
                description={
                  cameraTarget === "scan"
                    ? "Take an item picture. It will be added to this item and used for identify/autofill."
                    : "Capture a real item photo and add it to this item's saved photo list."
                }
                universe={values.universe}
                onCapture={handleCapturedPhoto}
                onClose={() => setIsCameraPanelOpen(false)}
                onUseFileInstead={() => {
                  setIsCameraPanelOpen(false);
                  if (cameraTarget === "scan") {
                    uploadInputRef.current?.click();
                    return;
                  }
                  mediaInputRef.current?.click();
                }}
              />,
              document.body
            )
          : null}
```

**What changed:**
- Wrapped in `createPortal(..., document.body)` — renders the camera modal directly on `<body>`, outside all page stacking contexts
- Added `mounted &&` guard — prevents SSR hydration mismatch (same pattern already used for the crop editor portal)
- Added `typeof document !== "undefined"` guard — same defensive check already on the crop editor

The content of `CameraCapturePanel` and all its props are identical — this is purely a rendering location change.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Clicking "Camera" button on Fast Entry page opens the camera modal immediately
- [ ] Clicking "Take New Picture" (center gold button) also opens the camera modal
- [ ] Camera shows live feed (or an error if no camera) within 3 seconds — not a 20-second blank
- [ ] Closing the camera panel (X button) works
- [ ] Capturing a photo and using it for Auto Identify works
- [ ] Crop editor still works (verify the portal didn't break anything — it shouldn't)

Commit: `fix: move CameraCapturePanel into createPortal — fixes buttons silently doing nothing`
