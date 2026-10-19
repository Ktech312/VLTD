# Revision list (visual and behaviour corrections)

One list for the owner's review of normal behaviour and appearance. **Specific corrections the owner has already sent are AUTHORIZED and are done without another approval.** Only genuinely undecided product questions are marked "decision". Unresolved incidents are kept in their own section at the end and are not part of the visual list. Tutorials and media rebuilding stay paused.

## A. Authorized corrections (sent by the owner; proceed without further approval)
| # | Where | Correction | Status |
|---|---|---|---|
| A1 | Vault tab row | **Restore Insurance as a first-class Vault section**: an Insurance tab beside Goals in the shared Vault tab row on every Vault page; connected to the existing `/insurance` workflow (inventory, item sheet, policy packet, print/export); inside the persistent Vault shell; documentation readiness kept distinct from insurance coverage | in progress (2026-10-18) |
| A2 | Goals | Remove Insurance from the goal-type filter row (it must not stand in for the Insurance section); hide the remaining type filters when there are no goals and show an explanation with a Create Goal action; keep existing goal records and the other goal types; verify the filters with populated QA goals (selection changes results; an unmatched filter shows an explicit empty state) | in progress |
| A3 | Goals | Remove the visible development-placeholder text ("Milestones will appear here after goal due dates are added to the goal model") | in progress |
| A4 | Verification record | The earlier tests did not establish that the Goals filter controls were useful or that Insurance stayed discoverable. This gap is recorded in HANDOFF; results are reported as focused production checks, not as a claim that the whole app was tested | in progress |

## B. Owner feedback from the review of normal behaviour and appearance (to be filled in)
| # | Where | What was seen | What was expected | Status |
|---|---|---|---|---|
| | | | | |

## C. Small product questions (decision needed from the owner)
| # | Where | Question | Notes |
|---|---|---|---|
| C1 | Vault load error | The Vault's own load error says "Try again"; the newer notices say "Retry". Make them the same word? | wording only |
| C2 | Items with a recorded $0 cost | Show "$0 at purchase cost", or word a recorded $0 differently? | `supabase/validation/test-value-rule.ts` |
| C3 | Sold filters | The category chips only appear when sales span three or more categories; change? | existing behaviour |
| C4 | Insurance documents | The inventory, item sheet and packet still state an item with no valuation and no cost as "$0"; should they say "Missing value" like the rest of the app? (The value rule itself is verified elsewhere.) | noticed while restoring Insurance |

## D. Unresolved incidents (separate from the revision list; no change without approval)
- **Missing-item attribution:** the two records are identified by id and title; who or what removed them, and when, is not established. Restoring them and applying the proposed deletion audit both need approval. See `docs/investigations/reliability-investigation-2026-10-18.md`, `docs/proposals/vault-items-deletion-audit-2026-10-18.md`.
- **Historical blank load:** cause unknown (recovery and diagnostics verified, not an explanation).
- **Physical devices:** no real phone or tablet has been used; every phone/touch check was browser-emulated.
- **Reliability fixes (saved-data notice, bounded retries, Sold/For Sale loading, value rule):** closed and verified; not to be rerun.
