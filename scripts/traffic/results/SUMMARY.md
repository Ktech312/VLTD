# 2026-11-08: automatic link prefetching off + launch counter read once

Same harness, same simulated database, local production builds of `b512c63` (before) and of this change (after); each route loaded 3 times in a fresh browser (empty cache), medians shown. Requests are those made to the app's own server.

| | before | after |
|---|---|---|
| 14 routes, cold, total requests | 1,291 | 556 (-56.9%) |
| of which link prefetch requests | 505 | 0 |
| warm second visit (Vault / Insights / Home) | 86 / 62 / 66 | 23 / 16 / 13 |
| Vault, scrolled 8 screens (80 items) | 119 prefetch requests | 0 |
| public home left open 95 s | 3 counter calls after the first | 0 |
| header-link navigation, URL change / content ready | Vault 60/441 ms, Insights 101/301, Exhibitions 15/129, Home 13/77 | Vault 131/486, Insights 124/373, Exhibitions 53/154, Home 47/93 |
| Back after opening an item (Vault scrolled 900 px) | 144 ms, scroll restored in 3/3 | 181 ms, scroll restored in 3/3 |

Navigation is 25-70 ms slower on a local server because the page data is now requested when a link is followed instead of earlier; on the live site that is roughly one network round trip per navigation. Back and scroll restoration are unchanged.
Raw results: `measure-before-b512c63.json`, `measure-after-prefetch-off.json`.
