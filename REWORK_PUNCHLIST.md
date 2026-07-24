# VLTD Rework Punch-List

Last updated: 2026-07-23. Production build passes; app scans clean (no dead
controls, no garbled text, no fake item art).

---

## Done

### Functionality / no-fake-data
- **21 dead controls wired** across Wishlist, Discover, Goals, Activity (every
  button now does something real).
- **Garbled text removed** (the `â€¹` / `Ã—` mojibake on Wishlist and Goals).
- **Activity fake data removed** — invented "confidence"/"comps" on sales,
  exhibitions, and comments; hardcoded movie-poster thumbnails.
- **Discover section groupings made real** — Trending / New This Week / Notable
  were the same list sliced three ways; now sorted by views, real last-7-days,
  and item count.
- **Value-change activity finished** — `activity_events` table created and
  `saveItem()` writes real before/after values.

### Numbers agree now
- **Vault totals unified** — Dashboard/Insights no longer count sold items;
  all three read 134 items / $19,482 (the Vault was right).
- **Gallery values fixed** — Discover's invented `views×1250 + items×700` is
  gone; both Exhibitions and Discover sum real item values (7/8 Test = $3,940
  on both). Verified live.

### Internal tracking IDs (permanent)
- Account ID `YYMMDD-####` (join date + daily sequence), Item ID adds a
  per-collection `-000000`. System-assigned, never reused, auto-assigned on
  create (trigger, verified live). All 1,021 existing items backfilled.
  Shown as "Vault ID" on the item page + in CSV/JSON/insurance exports.

### Universe placeholders (honest "add a photo" nudge)
- No surface fakes an item with keyword-guessed stock art anymore. Real photo
  when present, else a Universe-matched placeholder: **Activity, Vault
  (with "Add photo"), Goals, Watchlist**. (The logo animation's collectible
  images are branded decoration — left alone.)

### Add flow rebuilt (phone-camera model)
- One camera-live screen: open → live camera embedded inline (no modal) →
  snap → crop/filter → AI identifies → "Confirm details" review. Verified
  end-to-end live (high-confidence identify, fields filled, auto-categorized).
- "Add Item" everywhere (dashboard, vault buttons, bottom-nav +) points to it;
  Smart Scan is no longer a separate door. Quick Add kept (snap now, fill
  later); full manual entry is a tucked link.
- Fixed: post-scan screen fits mobile; captured photo no longer darkened (a
  full-image 35% scrim was removed); crop drag no longer pull-to-refreshes the
  page; crop auto-fits the subject after background removal.

### Auth
- **Expired session no longer sends real users to onboarding** — it sends them
  to login. Would have hit testers.

### Repo hygiene
- `/tmp/` (168MB) ignored; `tsconfig.tsbuildinfo` untracked; project docs and
  scripts committed.

---

## Open — needs YOU (decision or device)

1. **Bulk image upload** — you want to design the flow together (upload many,
   file into items, sort). Not started; discuss first. IDs are ready so every
   uploaded item gets a permanent code automatically.
2. **Item photos** — 98 of 141 items have none. Placeholders make this honest;
   the real fix is the bulk upload above (or adding photos one by one).
3. **Watchlist vs Wishlist naming** — mockups/nav say "Watchlist"; the route is
   `/wishlist` and there's a `watchlistModel`. Pick one name; the rename
   touches the route, model, and links, so I want your call first.
4. **Capture on a real phone** — confirm: crop drag doesn't refresh, photo
   isn't dark, crop lands on the item after background removal.
5. **Background-removal performance** — it froze the desktop browser for ~40s
   during processing (heavy on-thread ML). Likely worse on a phone. Worth a
   perf pass, but needs on-device testing.

## Open — smaller / later
- Insights value-history chart scaling looked off during the audit (axis to
  $150K on a ~$20K vault) — worth a look.
- The crop/filter step after snapping is one extra tap; could be made
  skippable for the casual path.
- `vltd.app` domain: intentionally not set up yet (you test on vltd.vercel.app).
  At launch, point it at Vercel AND set `NEXT_PUBLIC_SITE_URL` so share links
  use it. Not a bug.
