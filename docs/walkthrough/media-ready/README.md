# VLTD tutorial videos — review package (2026-10-14)

Open **[index.html](index.html)** for a page with every video playable in place and links to every file. **Nothing here is published, uploaded or linked from the app.**

## Revision 2 (2026-10-14, polish pass)

Videos, thumbnails, captions and Help screenshots were rebuilt with larger focus shots and highlighted controls. See **[CHANGE-REPORT.md](CHANGE-REPORT.md)** for what changed and how it was checked. Nothing in the VLTD app was changed.

## What these are

- **Screenshot-based videos with captions and zooms, not screen recordings.** They were built from screenshots of the live site (tested in a desktop browser with synthetic data). No cursor movement is shown, so nothing here pretends to be an interaction that was not tested.
- No voice-over and no music. The text is burned in; `.vtt` / `.srt` files carry the same text. `narration-script.md` is ready if a voice is recorded later.
- Captured against production on 2026-10-14 (code through commit `75b59aa`). Re-check the labels if the app changes.
- Cyan rings mark the control being demonstrated. Zooms stay at about 2x or less of the original capture; the Help screenshots show the same zoomed, marked view.

## Which file is for what

| Use | Files |
|---|---|
| YouTube / landscape (1920×1080) | `01-…`, `02-…`, `03-…`, `04-…` folders: MP4 + VTT + SRT + thumbnail + narration script + title/description |
| Vertical social (1080×1920, ~30–40 s) | `social-vertical/`: two MP4s with VTT/SRT, thumbnail, script, post text |
| Help material | `help-guide/index.html` (numbered screenshots, alt text, links to the videos) plus separate topics `help-guide/delete-an-item-or-exhibition.html` and `help-guide/reset-your-password.html`. Not connected to any Help route yet |

| Video | Length | Folder |
|---|---|---|
| Add your first item | 1:24 | `01-add-your-first-item/` |
| Build and share an exhibition | 1:44 | `02-build-and-share-an-exhibition/` |
| Import your collection | 1:17 | `03-import-your-collection/` |
| Switch between Personal and Business | 1:08 | `04-switch-personal-and-business/` |
| Add it to your Vault (social) | 0:39 | `social-vertical/add-it-to-your-vault.mp4` |
| Turn your collection into an exhibition (social) | 0:33 | `social-vertical/turn-your-collection-into-an-exhibition.mp4` |

## Not shown on purpose

- Camera capture (blocked in the test browser; not verified with a real device) — the tutorials use the verified photo-upload path.
- Arranging items by dragging (verified only with scripted drag events, not a real mouse or touch).
- Deleting and password recovery — separate Help topics (text only).
- Phone layouts (emulated only elsewhere; not recorded).

## Label check against the current app (for whoever integrates the Help section)

The existing `/guide/walkthrough` page was **not** changed. Wording there that no longer matches what the app shows:

| Existing Help wording | What the app shows now |
|---|---|
| "Enter its item name" | The field is labelled **Title** |
| "Open CATEGORY … choose Save to Vault" | **Universe** and **Category** are shown directly on the Add form, and the button is **Save** |
| "choose New exhibit or Create Exhibition" | **Create First Exhibition** (empty state) or **+ Create Exhibition** |
| "choose Save at the bottom of the picker" | The picker's button is **Add to Exhibit (n)** |
| "Use Organize to arrange the display" | **Organize** only appears once an exhibition has an exhibit page; items can be reordered under **Advanced → Selected Items** |

## Repository note

The MP4 files total about 60 MB, so they are kept out of git on purpose; the scripts, captions, thumbnails, screenshots and HTML are committed. Say the word to commit the videos too.
