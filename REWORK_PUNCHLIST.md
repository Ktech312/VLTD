# VLTD Rework Punch-List

Dead-control pass: done. Visual audit vs mockups: done 2026-07-18 against the
live site (`vltd.vercel.app`) while signed in.

---

## Headline

**The redesign is largely in place.** Every page I could compare matches its
mockup's structure and styling reasonably well. The real problems are **data
and consistency**, not layout.

The two things that most make the app look unfinished versus the mockups:
1. **98 of 141 items have no photo** — the mockups are carried by imagery.
2. **The same numbers disagree from page to page** (below).

---

## 1. Numbers disagree across pages (most serious)

| Thing | Vault | Dashboard | Insights | Database |
|---|---|---|---|---|
| Item count | 134 | 139 | — | **141** |
| Total value | **$19,482** | $20,822 | $20,822 | — |

Gallery values are worse:

| Gallery | Exhibitions page | Discover page |
|---|---|---|
| 7/8 Test | **$3,940** | **$58,300** |
| Grails | **$16** | **$18,000** |

Same object, wildly different numbers depending on the screen. Until one
source of truth computes these, any number shown is untrustworthy.

## 2. Insights value-history chart is wrong

The chart's axis runs **$30K–$150K** while the vault is worth **$20,822**, and
there's a spike-and-crash to near zero around Feb–Mar 2026. The shape does not
reflect the real vault. Also "Amazing Spider-Man - 300 - May - 1988" is listed
twice in Biggest Gainers.

## 3. Fake-looking stock art fills in for missing photos

98 items have no photo. The Vault is honest about this ("NO PHOTO"), but:
- **Watchlist** and **Activity** show generic comic-slab / card artwork chosen
  by keyword matching, which reads as though it were the real item.
- **Discover** "Featured items" repeats the same Spider-Man logo 4–5 times.

This is the "no fake data" rule being broken visually rather than numerically.
Either show real photos or show an honest empty frame like the Vault does.

## 4. Capture doesn't match its mockup

Mockup 10 shows a form-first **"New Vault Item"** screen (Identity, Category,
Location, Value, Documents, draft items). The live page opens **straight into
a live camera modal**. The webcam stream also froze the browser renderer hard
enough that screenshots timed out — worth a performance look.

## 5. Smaller items

- **Exhibitions**: all room cover images are blank.
- **Test data in production**: "7/8 Test", "Test 6/7", "New Live" (0 items, $0).
- **Duplicates**: "Magnolia Flower" twice on Watchlist.
- **`vltd.app` does not load at all** — the custom domain errors in a browser.
  `vltd.vercel.app` is what works.

---

## Page-by-page

| Mockup | Route | Verdict |
|---|---|---|
| Home | `/dashboard` | Matches well. Counts disagree with Vault. |
| Vault | `/vault` | Matches. Held back by missing photos + wrong totals. |
| Discover | `/discover` | Matches; controls now real. Gallery values wrong. |
| Exhibitions | `/museum` | Matches. Blank covers, test galleries. |
| Insights | `/portfolio` | Matches closely. **Chart data wrong.** |
| Watchlist | `/wishlist` | Matches; controls now real. Stock art, duplicates. |
| Goals | `/goals` | Matches. Honest empty state. Clean. |
| Learn | `/learn` | **Done** — rebuilt to mockup, all controls real. |
| Activity | `/activity` | Matches; controls now real. Stock art. |
| Capture | `/capture` | **Differs** — camera-first vs form-first mockup. |

---

## Already fixed (earlier this session)

- All 21 dead controls wired (Wishlist 9, Discover 6, Goals 4, Activity 2).
- Garbled `â€¹` / `Ã—` characters removed.
- Discover's "Trending / New This Week / Notable" are real groupings now.
- `activity_events` table created + `saveItem()` writes real before/after values.
- **Expired session no longer sends real users to onboarding** — it sends them
  to login. This one would have hit your testers.

## Open decisions for you

1. **Watchlist vs Wishlist** — mockups and nav say Watchlist; route is
   `/wishlist`. Pick one.
2. **Item photos** — the single biggest visual gap. Bulk-add images, or accept
   honest empty frames everywhere (and strip the keyword stock art).
3. **Capture** — keep camera-first, or rebuild to the form-first mockup?
