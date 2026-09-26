# NYCC remaining browser checks — ready-to-run reference

Prepared 2026-09-26 while the embedded browser was down, so the next session
with a working authenticated browser can execute immediately without
re-deriving anything. See HANDOFF.md's 2026-09-26 entry for full narrative.

Anon key (public, safe to use in headers): `sb_publishable_E7XyFgRnnyYGKLrHGsGWFQ_Y-5WBF2-`
Supabase URL: `https://intxhrrtuzgodfzgavlo.supabase.co`

Get the session token once per tab (never print it, just store it for reuse):
```js
const raw = localStorage.getItem('vltd-auth');
const parsed = JSON.parse(raw);
window.__t = parsed?.access_token || parsed?.currentSession?.access_token;
```

Then every REST call looks like:
```js
fetch('https://intxhrrtuzgodfzgavlo.supabase.co/rest/v1/<path>', {
  cache: 'no-store',
  headers: { 'Authorization': 'Bearer ' + window.__t, 'apikey': 'sb_publishable_E7XyFgRnnyYGKLrHGsGWFQ_Y-5WBF2-' }
})
```

## Check 1–2: create in session A, confirm through session B's UI

1. In session A (`/capture`): create an item with a unique title, e.g.
   `NYCC Cross-Session <today's date/time>`. Note the returned id from:
   ```js
   JSON.parse(localStorage.getItem('vltd_vault_items_v1')||'[]').find(i=>i.title.includes('NYCC Cross-Session'))
   ```
2. In session B: this must be a **second tab whose `vltd_vault_items_v1` /
   `vltd_galleries` local storage keys are cleared first** (clearing those
   two keys and reloading is the closest achievable proxy to "clean session"
   without a second real login — see HANDOFF.md's honest caveat on this).
   Reload `/vault`, and confirm the item **appears in the rendered grid**
   (not just via a direct query) — search the DOM for the exact title text.

## Check 3: edit in A, confirm in B

Edit the same item's title or value in session A (via `/vault/item/<id>`,
the "Basic Record" edit UI). Reload session B's `/vault/item/<id>` page and
confirm the **new** title/value renders — not a stale cached one.

## Check 4: delete individually, confirm in B + Supabase

Delete via the item-detail page's "Delete Forever" (the confirmed, awaited
path — `deleteVaultItemEverywhere`). Then:
```js
fetch('.../rest/v1/vault_items?id=eq.<id>&select=id', {headers...}) // expect []
```
Reload session B and confirm the item is gone from the rendered Vault grid,
not just absent from a query.

## Check 5: mass-delete disposables

Create 2–3 more disposable items (unique titles), select them in the Vault
grid's multi-select mode, mass-delete. Then confirm all four of:
- Vault grid (rendered UI) — items gone
- `vault_items` table — rows gone (`select=id` for each id, expect `[]`)
- Any gallery those items belonged to — `itemIds`/`exhibition_layout.itemIds`
  no longer contain the deleted ids (only relevant if you added them to an
  exhibition first; not required if they were never added to one)
- `gallery_items` — same check, only relevant if applicable

## Check 6: real ~390px screenshots, authenticated routes

Claude-in-Chrome's `resize_window` was confirmed non-functional this pass
(`window.outerWidth`/`outerHeight` report `0` — no real window to resize).
Before spending time on it again, first re-check whether it's still broken:
```js
({outerWidth: window.outerWidth, outerHeight: window.outerHeight})
```
If still `0`, this specific tool cannot do it — screenshots for Vault, Add
Item, and Exhibitions will need either a fixed tool, or a different avenue
(e.g. asking EK to grab three screenshots on their own phone).

## Check 7: genuine cold-cache timing

This session's browser profile had a warm HTTP cache the whole time from
repeated testing. A genuine cold measurement needs either a profile that's
never hit vltd.vercel.app, or clearing the browser's actual HTTP cache (not
just localStorage) — `navigator.serviceWorker`/Cache API inspection first
to see if a service worker is even in play:
```js
navigator.serviceWorker?.getRegistrations().then(r => r.length)
```
Then use `performance.getEntriesByType('navigation')[0]` on the very first
load of a fresh tab, per route, before that route is visited again.

## Cleanup reminder

Every disposable item/exhibition created for these checks must be deleted
before closing out — confirm zero stray `NYCC`-titled rows remain in
`vault_items` when done:
```js
fetch('.../rest/v1/vault_items?title=ilike.*NYCC*&select=id,title', {headers...})
```
