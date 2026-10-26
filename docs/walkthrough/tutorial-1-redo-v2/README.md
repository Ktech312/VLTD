# Tutorial 1 (redo), second preview: Quick Add and Add Item

**Status: private preview for the owner's review. Not published. The live Help tutorial is untouched.** This preview replaces nothing: the first preview is kept unchanged at `docs/walkthrough/tutorial-1-redo/` (and the original tutorial at `docs/walkthrough/media-ready/01-add-your-first-item/`).

Open [index.html](index.html): both chapters play in place with the numbered steps, captions, narration and checks.

## What changed from the first preview
The app was repaired (five recording findings, see [FINDINGS.md](FINDINGS.md)), so only the screens those repairs changed were re-recorded against the deployed app. Everything else keeps its original capture, unchanged.

**Re-recorded (18 steps):** Chapter 1: Name each item (1.15), Add what you know (1.16), Open the item to check it (1.20). Chapter 2: The Add Item form (2.2), Keep the photo or retake it (2.5), The photo is on your item (2.6), Open it and check (2.11), Purchase details live on the item (2.12), Add the extra costs (2.13), Extra costs saved (2.14), Cost and value stay separate (2.15), Reload and check it stuck (2.16), Zero stays zero, blank stays unknown (2.20), and the phone steps: The Add Item form on a phone (2.21), Take a photo (2.22), Keep or retake (2.23), Type the name (2.24). Chapter 1's phone step "Name each item, then save" (1.25) too.

**Replaced:** the old Chapter 1 step "Identify with AI is optional and account-dependent" (a screenshot of the server refusing AI) is now an explanation card, because an account without AI is no longer shown the button at all. AI is explained on that card and in the narration.

**Wording updated:** the Chapter 1 intro, the phone cards, and the captions and narration of the steps above (no rounding warning on costs, no "tap the top edge" advice on phones, no AI button on screens that no longer have one).

## Format and honesty (unchanged)
- Silent, captioned, screenshot-based videos made from real captures of the deployed app with synthetic data. **Not screen recordings.** Full narration script, no voice generated.
- **Simulated:** the camera (a test camera playing fictional pictures); the browser's permission prompt cannot be captured, so a card stands in; phone screens come from a phone-size test browser.
- **No AI request** was made. The recorded account has no AI access, which is exactly what the app now shows.
- Every account, item and photo is synthetic and was removed afterwards.

## Files
`index.html` (preview), `chapter-1-quick-add/`, `chapter-2-add-item/` (MP4, VTT, SRT, thumbnail, numbered annotated screenshots), `narration-script.md`, `VERIFICATION.md`, `FINDINGS.md`, `_build/` (capture, merge and build scripts; `merge-work.cjs` shows exactly which steps were re-recorded).
