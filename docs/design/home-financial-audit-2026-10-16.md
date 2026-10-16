# Home: financial features audit and proposed adjustment (2026-10-16)

Status: **proposal for review. Nothing on Home has been changed.**

Compared: the Home / "Command Center" before the Oct 11 merge (`HomeClient.tsx` at `4438779^`) with Home today (`HomeClient.tsx`, also served at `/dashboard`).

## Coverage table

| Feature (old Command Center) | Where it was | Where it is today | Status |
|---|---|---|---|
| Items, Invested, Value, Return tiles | Hero | Home summary (same four tiles, with the "Value basis" line and a priced-only / include-unpriced switch) | Kept |
| Value basis switch (priced only vs at purchase price) | Hero + value card | Home summary, Vault Total Value card, Insights (one shared setting) | Kept |
| Collection value card with 30-day trend line and overall return | Right sidebar | Insights → "Total Vault Value" tile with trend and Value history chart. **Not on Home.** | Moved off Home |
| "View analytics" (realized sales: revenue, profit after fees, monthly chart) | Link under the value card | `/vault/sold`. **No link from Home**; reachable only from the Vault's local navigation | Hidden |
| Curator Strength (score, band, highlights, ROI, top 3 pieces by value) | Full-width card | **Nowhere.** `src/lib/collectorStrength.ts` is no longer used by any page | Lost |
| Biggest Movers (gainers and losers) | Panel beside Quick Actions | Insights → "Portfolio Movers" | Moved off Home |
| Stale prices / items not priced recently | Not on old Home | Insights → "Stale Prices"; Vault Total Value card shows the count | n/a |
| Insurance covered | Not on old Home | Insights → "Insurance Covered"; `/portfolio/insurance`; `/insurance` packet | n/a |
| Recently added items with value ("at cost" when unpriced) | Right sidebar | Home → "Recently added" (six items, value or "at cost" / "Not valued") | Kept |
| Quick Actions (Add, Quick Add, Vault, Exhibitions, Saved, Activity) | Card | Add / Quick Add in the header; Vault and Exhibitions in the main navigation; Activity button on Home; Saved only via More | Mostly kept |
| Activity (recent value changes, sales, exhibitions) | Quick Actions tile | Home summary → "Activity" button; `/activity` | Kept (one pill) |
| Upcoming events | Left column widget | Not on Home; `/events` via Discover | Moved off Home |
| Featured / Active Exhibitions | Two cards | Home → "Your exhibitions" (one preview) | Reduced |

What a visitor to Home sees about money today: four numbers and two small pills (Insights, Activity). Realized sales, movers, trend and the value-history chart are one or two clicks away and nothing on Home says they exist.

## Definitions to keep straight (all already in the code, reused as they are)

- **Invested / purchase cost:** purchase price + tax + shipping + fees for every counted item (`vaultStats.totalCost`).
- **Estimated value:** a value someone entered or looked up. An item with none counts at its purchase price shown in grey ("at cost"); the priced-only switch leaves it out.
- **Unrealized change (the "Return"):** estimated value minus cost. Only meaningful for priced items. When nothing is priced the tile shows "—", never 0% (already how Home behaves).
- **Realized sales:** items actually sold: sale price minus cost minus estimated seller fees (`/vault/sold`). Separate from, and never mixed into, the estimated value.

## Proposed adjustment (one change): a "Collection finances" band directly under the summary

```
┌ Summary (unchanged): Welcome back, <name>   Items · Invested · Value · Return    [Add Item] [Insights] [Activity]
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌ COLLECTION FINANCES ───────────────────────────────────────────────────────────── View Insights → ┐
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                  │
│ │ Estimated value │ │ Invested        │ │ Unrealized      │ │ Realized sales  │                  │
│ │ $12,400         │ │ $9,850          │ │ change          │ │ $2,100 revenue  │                  │
│ │ 38 of 41 priced │ │ purchase cost   │ │ +$1,980 (+21%)  │ │ +$640 profit    │                  │
│ │ ▁▂▂▃▄▄▅ 30 days │ │ incl. tax/fees  │ │ priced items    │ │ 6 sold          │                  │
│ │ Open breakdown ›│ │ Open breakdown ›│ │ Biggest movers ›│ │ Sales analytics›│                  │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘                  │
│ Needs attention:  3 items have no value · 5 prices older than 6 months   → opens the Vault list │
│ Latest activity:  Value updated · Sold "Item" for $120 · Added "Item"                  See all → │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

(then: Notices · Recently added · Your exhibitions · Lounge · Learn, unchanged)
```

- Tiles are links with visible focus; on a phone they stack two by two. The existing summary tiles stay as they are (no duplicated numbers: the band adds the drill-downs and the sales side).
- **Estimated value** → `/portfolio` (value history chart); **Invested** → `/portfolio` (breakdown by universe / category); **Unrealized change** → Insights movers; **Realized sales** → `/vault/sold`. The "Needs attention" line opens the Vault with the same lists as the Vault's Needs Review and stale-price counts; "Latest activity" → `/activity`.
- **Accuracy rules:** the three kinds of number are labelled differently (purchase cost, estimated value, realized). Unrealized change is computed over priced items only and says so; with nothing priced it reads "Not enough values yet", not 0%. Realized sales show "No sales yet" when empty, not $0 profit. The sparkline appears only when there are at least two days of history.
- Reuses `summarizeValues`, the value-history store, `totalsValue`, the sold-items calculation from `/vault/sold` and the stale-price rule already used by the Vault. No new calculation, no new data.
- Not included (separate decisions): bringing back Curator Strength (nothing uses `collectorStrength.ts` now), Upcoming events, or the two-exhibition carousels.

## Decision needed

Approve the band as drawn, or say what to change. Nothing will be implemented until you do.
