# Tutorial 1 (redo): Quick Add and Add Item: review package

**Status: private preview for the owner's review. Not published. The live Help tutorial is untouched. The previous version is preserved, unchanged, at `docs/walkthrough/media-ready/01-add-your-first-item/` (and the in-app Add Item video at `public/guide-media/add-item.mp4`).**

Open [index.html](index.html): both chapters play in place, with the numbered screenshot steps, captions, narration and the check that was run for each step.

## What is here

| File | What it is |
|---|---|
| `index.html` | The preview page. Videos, numbered steps, captions, narration, verification marks. |
| `chapter-1-quick-add/` | Chapter 1 video (MP4), captions (VTT, SRT), thumbnail, timeline, and the numbered annotated screenshots. |
| `chapter-2-add-item/` | Chapter 2, same files. |
| `narration-script.md` | The complete narration for a later voice-over. **No voice was generated.** |
| `VERIFICATION.md` | Every demonstrated instruction, the check that ran on the deployed app, the evidence, and which steps are simulated. |
| `FINDINGS.md` | Defects and observations found while recording. **None were fixed in this pass.** |
| `_build/` | The scripts that captured the app, wrote the captions and built the videos, so everything can be regenerated if the app changes. |

## Format and honesty
- **Silent, captioned, screenshot-based.** Captions are burned into the picture and also supplied as VTT/SRT. Each video is made from screenshots of the deployed app (https://vltd.app, 2026-10-26) with highlights and gentle zooms. They are **not screen recordings** of a person using the app.
- **Simulated: the camera.** Chrome's test camera played a looping file of fictional pictures (a sports card, a trading card, a boxed toy, a comic cover and a deliberately blurry accidental shot). No real camera, item or brand appears. The browser's own camera-permission prompt cannot be captured, so an explanation card stands in for it; the blocked-camera message is the app's own, captured with the permission set to Blocked.
- **Simulated: nothing about AI.** No AI request was paid for. The one AI screen is the live server's real refusal for an account without AI access.
- **Phone screens** come from a phone-size test browser (390 x 844, touch), not a physical phone.
- **Reading time:** each step stays on screen for 8 to 26 seconds, sized to its caption. The old tutorial was 84 seconds for the whole of "Add your first item".
- Every account, item and photo is synthetic. The collector and all its items were removed afterwards.

## Chapters
1. **Quick Add** (where it is, what it is for, camera permission, taking photos, reviewing several items, removing one, correcting details, naming, optional AI, saving, finding the items in the Vault, and a phone section). Includes where every entry point leads: Home and Vault buttons, the empty-Vault buttons, Upload from device, and Add manually.
2. **Add Item** (the full form: required versus optional, taking or uploading a photo, keep or retake, title, Universe/Category, purchase price and value kept separate, blank versus zero, how an unvalued item counts at purchase cost, extra costs on the item page, saving, finding it, reopening it, and a phone section).

## Not covered on purpose
Bulk Upload, imports, exhibitions, social videos, the other tutorials, and the Add manually form (only mapped, not taught).

Synthetic pictures and the test-camera feed are made by make-assets.cjs and make-feed.cjs (paths inside point at the original scratchpad: adjust before reuse).
