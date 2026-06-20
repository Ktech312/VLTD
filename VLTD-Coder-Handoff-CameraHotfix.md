# VLTD — Camera Hotfix: Slow Start + Viewfinder Too Tall

**File:** `src/components/CameraCapturePanel.tsx`
**Priority:** Ship immediately — camera broken for new users

Two targeted changes. Do not change anything else.

---

## Fix A — Camera 20-second startup (regression from hotfix)

The problem: `{ facingMode: { ideal: "environment" } }` causes desktop Chrome to probe all video input sources looking for a rear-facing camera. On desktop webcams that have no facing mode metadata this can stall for 15–20 seconds.

Find this block (around line 207–226):

```tsx
const preferredDeviceId = preferredDeviceIdRef.current;
const requestedDevice = preferredDeviceId
  ? {
      deviceId: { exact: preferredDeviceId },
    }
  : {
      facingMode: { ideal: "environment" },
    };

try {
  stream = await navigator.mediaDevices.getUserMedia({
    video: requestedDevice,
    audio: false,
  });
} catch {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
}
```

Replace with:

```tsx
const preferredDeviceId = preferredDeviceIdRef.current;

try {
  stream = await navigator.mediaDevices.getUserMedia({
    video: preferredDeviceId
      ? { deviceId: { exact: preferredDeviceId } }
      : true,
    audio: false,
  });
} catch {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
}
```

**What changed:** When no preferred device is set, request `{ video: true }` — the most permissive constraint. The browser returns the first available camera immediately with no probing. The fallback is already `{ video: true }` so the catch block becomes a pure safety net.

---

## Fix B — Viewfinder still too tall (Tailwind min() class not applying)

The problem: `h-[min(36dvh,320px)]` uses a CSS `min()` function inside a Tailwind arbitrary value. Tailwind v4's JIT scanner does not always detect CSS math functions in class names, so the height class generates no rule and the element takes its natural height (which is very tall).

Find this div (around line 740):

```tsx
<div className="relative flex h-[min(36dvh,320px)] min-h-[190px] items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]">
```

Replace with:

```tsx
<div
  className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]"
  style={{ height: "min(30dvh, 240px)", minHeight: "160px" }}
>
```

**What changed:** Moved the height from a Tailwind class to an inline style — inline styles are not processed by the build system, so they always apply exactly as written. `min(30dvh, 240px)` is standard CSS that every modern browser supports. Dropping from 36dvh to 30dvh also gives the Capture Photo button guaranteed room to appear on 800px+ screens.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Camera opens and shows a live feed in under 3 seconds on desktop
- [ ] Camera opens in under 3 seconds on a second open (preferred device ID path)
- [ ] Live camera viewfinder is visibly shorter than before — "Capture Photo" button is fully visible without scrolling on a 800px screen
- [ ] Webcam selector dropdown still works and switching cameras still restarts with the exact selected device

Commit: `fix: camera startup regression — use video:true for initial request, inline style for viewfinder height`
