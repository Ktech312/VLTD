# Quick Add walkthrough, corrected (v3)

Open `quick-add/index.html`, or play `quick-add/quick-add-v3.mp4` (captions are burned in; `.srt`/`.vtt` have the same text with times).
`quick-add/screenshots/` has one numbered still per scene. `quick-add/quick-add-v3.timeline.json` has the exact timing and ring rectangle of every scene.
Rebuild: `_build/build-v3.cjs <outDir>` (needs v2's capture set plus the phone Verify recapture made by `_build/capture-phone-verify.cjs`), then `_build/build-page.cjs`. The video was re-encoded afterwards with ffmpeg (libx264, crf 21, keyframe every 2 s, no audio) so seeking is reliable.
The list of changes from v2 is on the page.

Corrected after review: opens on Home with the title over it, phone Verify picture recaptured (toy correctly classed), "Photo captured", AI card removed, no production labels in the frames. See the page and VERIFICATION.md.
