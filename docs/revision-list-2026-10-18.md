# Revision list (single list for the owner's review of normal behaviour and appearance)

Opened 2026-10-18 after the correction sets and the reliability pass. **Add every new observation here; nothing is changed from it until the list is reviewed and agreed.** Tutorials and media rebuilding stay paused. The visual passes so far are the coder's reported checks (layout, colour and interaction measured in a browser), not a confirmation of how the pages look to the owner.

## How to read an entry
`# | where | what you saw | what you expected | status (new / agreed / done)`

## Owner feedback (to be filled in during the review)
| # | Where | What was seen | What was expected | Status |
|---|---|---|---|---|
| | | | | |

## Known items already on record (not yet decided; listed so they are not lost)
| # | Where | Item | Source | Status |
|---|---|---|---|---|
| K1 | Vault, Home, Sold, For Sale | Real phones and tablets have not been used: every phone/touch check was browser-emulated | `docs/visual-2026-10-18/README.md` | needs owner device check |
| K2 | Missing-item incident | Who or what removed the two identified records, and when, is unresolved; restoring them and applying the deletion audit both need approval | `docs/investigations/reliability-investigation-2026-10-18.md`, `docs/proposals/vault-items-deletion-audit-2026-10-18.md` | open (decision) |
| K3 | Historical blank load | Cause unknown (recovery and diagnostics verified) | same investigation | open |
| K4 | Vault | The load error on the Vault itself still says "Try again" while the new notices say "Retry" | wording only | owner's call |
| K5 | Insights, Home | Cards for items with a recorded $0 cost show "$0 at purchase cost"; whether to word a recorded $0 differently is a product call | `supabase/validation/test-value-rule.ts` | owner's call |
| K6 | Sold | The category filter chips only appear when sales span three or more categories | existing behaviour | owner's call |
| K7 | Scripts | Verification scripts retry nothing on purpose; first failures are kept beside the later passes | `docs/investigations/evidence-2026-10-18-pass3/` | note |
