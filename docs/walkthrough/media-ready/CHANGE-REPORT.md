# Change report: media polish pass (2026-10-14)

Scope: existing media only. No VLTD app code, copy or data changed. Nothing published; MP4s stay out of git.

## What changed

| # | Request | Result |
|---|---|---|
| 1 | Vertical exhibition preview shows the full title and selected items; Copy Link emphasised | **Social "Turn your collection into an exhibition"**: the preview step now uses a wide panel that holds the whole title and all four items (the old crop cut the title). The sharing step zooms about 3x on Copy Link with a ring. Length 0:31 to 0:33. |
| 2 | Review at ordinary size; focus shots where controls are small; sharper captures | 19 new high-resolution focus captures replace small full-page frames. In the tutorials each small control now gets its own zoomed step (up to about 2x on the capture) with a cyan ring: Add Item, Manual entry, Save, Private, Create Exhibition, Edit/Add, item picker, Make public, Copy Link, Import, Upload Spreadsheet, summary, duplicates and warnings, Add business profile, account menu. Tutorial 2 went from 10 to 12 steps because the visibility and picker steps were split. |
| 3 | Add Item save sequence unambiguous | Tutorial 1 and the vertical cut now run **Save (Ready to save and Save ringed) -> green "Saved!" banner alone -> the saved item in the Vault**. The empty reset form is never shown: the banner is cropped to the banner row, so there is no "Title required" pill after saving. |
| 4 | Play every export start to end | Done; see "How it was checked". Problems found and fixed: captions printed on top of each other during step-to-step dissolves (now only the screenshot dissolves; caption and step chip cut cleanly); crops that began under the app header; one ring clipped at the frame edge; thin crops that made Copy Link too small. |
| 5 | Thumbnails, captions, Help screenshots | All six thumbnails remade from the new shots. Caption files (.vtt/.srt), narration scripts, chapters and the review index regenerated from the new timings. Help guide screenshots are now the zoomed, ringed view of each step (36 numbered images: 9, 12, 8 and 7 per tutorial) instead of repeated full-page shots. The account email in the profile-menu shot is covered with a solid fill. |

| File | Before | After |
|---|---|---|
| add-your-first-item.mp4 | 1:37 | 1:24 |
| build-and-share-an-exhibition.mp4 | 1:58 | 1:44 |
| import-your-collection.mp4 | 1:37 | 1:17 |
| switch-personal-and-business.mp4 | 1:26 | 1:08 |
| add-it-to-your-vault.mp4 (vertical) | 0:39 | 0:39 |
| turn-your-collection-into-an-exhibition.mp4 (vertical) | 0:31 | 0:33 |

The tutorials are shorter because dwell time is now set per step instead of a flat 10.5 s.

## How it was checked

- Every MP4 was played to the end in a browser (correct size, no decode error, reached the end) and frames were sampled at each segment's start, just after the dissolve, once zoomed, and just before the next cut: 45, 57, 41 and 37 frames for the four tutorials and 29 and 21 for the vertical cuts (230 frames). Captions, rings, crops, transitions and redaction were inspected on those frames. This is a sampled review, not each of the roughly 6,000 frames.
- Highlight rings were checked on stills for every step before rendering, then again on the final frames.
- The profile-menu shot was checked for the covered email line; no frame shows an email address, password or link.

## Not changed / still true

- Screenshot-based videos (captions, zooms, dissolves), not screen recordings; no voice-over, music or cursor.
- Zoomed views are upscaled from the original capture; about 2x is the most used, readable at 1080p, soft at 4K.
- Camera capture, dragging to arrange, phone layouts and light themes are still not shown. Real-device checks, push and Comcast resend delivery remain UNVERIFIED.
- Existing Help page wording mismatches are listed in README.md; that page was not edited.
- The first-version MP4s were kept until these were verified and are archived outside the repository at `C:\Users\EK\VLTD-media-archive\v1-2026-10-14\`.
