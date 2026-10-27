# Quick Add package (local preview, not published)

Open `index.html` in this folder. Everything links relatively.

- `how-to/` combined landscape (the approved 2:26 video, byte-identical to `../quick-add/quick-add-v3.mp4`), desktop landscape (1:58), phone portrait (1:26).
- `promo/` promotional cut, portrait (0:23).
- Each video has `-thumbnail.jpg`, `.srt` and `.vtt` beside it. Captions are also burned in. No audio in any file.
- `package-manifest.json`: durations, sizes, dimensions, hashes.
- Build: `../_build/build-cuts.cjs <desktop|phone|promo> <dir>` then `../_build/build-package.cjs <dir> quick-add-package` (needs v2's capture set and the phone Verify recapture).
